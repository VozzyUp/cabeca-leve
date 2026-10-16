import crypto from "node:crypto";
import { BRAND } from "@/lib/brand";
import { sendEmail } from "@/lib/email";
import { newProtocol } from "@/lib/support";
import { planById } from "@/lib/plans";
import { loadPlans } from "@/lib/plans-server";
import { getAdmin } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/public-env";

// Cobrança pela Asaas (https://docs.asaas.com). Página de pagamento hospedada por eles:
// nenhum dado de cartão passa pelo nosso servidor.
// Cada plano do catálogo (Administração > Planos) escolhe a forma:
// - Renova sozinho (recurring): assinatura no cartão (Checkout RECURRENT, ciclo pela duração: mensal, trimestral, semestral ou anual).
// - Pagamento único: Pix ou cartão que libera `months` meses (Checkout DETACHED).
// O estado da assinatura vive no banco e só muda pelo webhook (app/api/webhooks/asaas).

const api = () => process.env.ASAAS_API_URL ?? "https://api-sandbox.asaas.com/v3";
const site = siteUrl;
export const billingEnabled = () => !!process.env.ASAAS_API_KEY;

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(`${api()}${path}`, {
    ...init, headers: { "Content-Type": "application/json", access_token: process.env.ASAAS_API_KEY ?? "", "User-Agent": "assistente-pessoal-ia", ...init.headers },
  });
  if (!res.ok) throw new Error(`asaas ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// "2026-10-08 12:00:00" no horário de Brasília, como a Asaas pede
const asaasDate = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" }).format(d);

export function checkoutUrl(id: string) {
  const host = api().includes("sandbox") ? "https://sandbox.asaas.com" : "https://asaas.com";
  return `${host}/checkoutSession/show?id=${encodeURIComponent(id)}`;
}

const CYCLE = { 1: "MONTHLY", 3: "QUARTERLY", 6: "SEMIANNUALLY", 12: "YEARLY" } as const;

export class PlanUnavailableError extends Error {}

export async function createCheckout(userId: string, plan: string, trialEndsOn: string | null) {
  const p = planById(await loadPlans(), plan);
  if (!p || p.kind !== "paid" || !p.active) throw new PlanUnavailableError("Plano indisponível");
  const callback = { successUrl: `${site()}/planos/obrigado`, cancelUrl: `${site()}/planos`, expiredUrl: `${site()}/planos?expirou=1` };
  const items = [{ name: `Plano ${p.name.toLowerCase()}`, description: `${BRAND.name}: assistente pessoal com IA`, quantity: 1, value: p.priceCents / 100 }];
  // quem ainda está no teste grátis só paga a 1ª mensalidade quando o teste acaba
  const firstDue = trialEndsOn && trialEndsOn > new Date().toISOString().slice(0, 10) ? new Date(`${trialEndsOn}T12:00:00-03:00`) : new Date();
  const body = p.recurring
    ? { billingTypes: ["CREDIT_CARD"], chargeTypes: ["RECURRENT"], minutesToExpire: 60, callback, items, externalReference: userId,
        subscription: { cycle: CYCLE[p.months], nextDueDate: asaasDate(firstDue) } }
    : { billingTypes: ["PIX", "CREDIT_CARD"], chargeTypes: ["DETACHED"], minutesToExpire: 60, callback, items, externalReference: userId };
  const { id } = (await asaas("/checkouts", { method: "POST", body: JSON.stringify(body) })) as { id: string };
  const { error } = await getAdmin().from("checkout_sessions").insert({ id, user_id: userId, plan });
  if (error) throw new Error(error.message);
  return checkoutUrl(id);
}

const longDate = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

// F1: cancelar dá comprovante (protocolo, data e até quando vale), no app e por e-mail
export async function cancelSubscription(userId: string) {
  const db = getAdmin();
  const { data: sub } = await db.from("subscriptions").select("id, provider_subscription_id, current_period_end, cancel_at_period_end, canceled_at").eq("user_id", userId)
    .in("status", ["active", "past_due", "trialing"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!sub || sub.canceled_at) return false;
  // anual é pagamento único: não há cobrança futura para cancelar, só não renova
  if (sub.provider_subscription_id.startsWith("sub_")) await asaas(`/subscriptions/${sub.provider_subscription_id}`, { method: "DELETE" });
  const protocol = newProtocol(), canceledAt = new Date().toISOString();
  await db.from("subscriptions").update({ cancel_at_period_end: true, canceled_at: canceledAt, cancel_protocol: protocol }).eq("id", sub.id);
  const until = sub.current_period_end ? longDate(sub.current_period_end) : null;
  const body = `Protocolo ${protocol}, em ${longDate(canceledAt)}. Nenhuma cobrança nova será feita.${until ? ` Seu acesso continua até ${until}.` : ""}`;
  await db.from("notices").insert({ user_id: userId, kind: "billing", title: "Assinatura cancelada", body, href: "/ajustes" });
  const { data: user } = await db.auth.admin.getUserById(userId);
  await sendEmail(user.user?.email ?? "", `${BRAND.name}: comprovante de cancelamento`, `Sua assinatura do ${BRAND.name} foi cancelada.\n\n${body}\n\nSe aparecer qualquer cobrança depois disto, nós estornamos automaticamente.`);
  return true;
}

// ---- webhook ----

export function verifyAsaasWebhook(headers: Headers) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
  const given = headers.get("asaas-access-token") ?? "";
  const a = Buffer.from(given), b = Buffer.from(expected);
  return expected.length >= 32 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

type AsaasEvent = {
  id: string;
  event: string;
  checkout?: { id: string; customer?: string | null };
  subscription?: { id: string; customer: string; cycle?: string; nextDueDate?: string };
  payment?: { id: string; customer: string; subscription?: string | null; dueDate?: string; status?: string };
};

// Troca de plano: o que o cliente tinha antes deixa de cobrar e de valer, para não pagar dois planos ao mesmo tempo
async function supersedeOthers(userId: string, keepRef: string) {
  const db = getAdmin();
  const { data: others } = await db.from("subscriptions").select("id, provider_subscription_id").eq("user_id", userId).neq("provider_subscription_id", keepRef).in("status", ["active", "trialing", "past_due"]);
  const now = new Date().toISOString();
  for (const o of others ?? []) {
    try {
      if (o.provider_subscription_id.startsWith("sub_")) await asaas(`/subscriptions/${o.provider_subscription_id}`, { method: "DELETE" });
    } catch (error) {
      console.error("não consegui encerrar a cobrança do plano anterior", o.provider_subscription_id, error);
      await db.from("notices").insert({ user_id: userId, kind: "billing", title: "Confira a cobrança do plano anterior",
        body: "Você trocou de plano, mas não consegui encerrar a cobrança do plano antigo. Peça para falar com uma pessoa para a gente resolver e estornar o que for devido.", href: "/ajustes/suporte" });
    }
    await db.from("subscriptions").update({ status: "canceled", cancel_at_period_end: true, canceled_at: now, current_period_end: now, updated_at: now }).eq("id", o.id);
  }
}

const addMonths = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString(); };

// Idempotente: o id do evento entra em billing_events (único); repetido não roda de novo
export async function handleAsaasEvent(e: AsaasEvent): Promise<"ok" | "duplicate" | "ignored"> {
  const db = getAdmin();
  const { data: row, error } = await db.from("billing_events").insert({ provider: "asaas", event_id: e.id, type: e.event, payload: e as never }).select("id").single();
  if (error) {
    if (error.code === "23505") return "duplicate";
    throw new Error(error.message);
  }
  let userId: string | null = null;
  let result: "ok" | "ignored" = "ok";

  if (e.event === "CHECKOUT_PAID" && e.checkout) {
    const { data: session } = await db.from("checkout_sessions").select("user_id, plan").eq("id", e.checkout.id).maybeSingle();
    if (session) {
      userId = session.user_id;
      await db.from("checkout_sessions").update({ status: "paid" }).eq("id", e.checkout.id);
      const bought = planById(await loadPlans(), session.plan);
      const once = bought ? !bought.recurring : false;
      const ref = `${once ? "checkout" : "pending"}:${e.checkout.id}`;
      await db.from("subscriptions").upsert({
        user_id: session.user_id, provider: "asaas", provider_customer_id: e.checkout.customer ?? "",
        provider_subscription_id: ref, plan: session.plan, status: "active",
        current_period_end: addMonths(new Date().toISOString().slice(0, 10), bought?.months ?? 1), cancel_at_period_end: once,
      }, { onConflict: "provider_subscription_id" });
      await supersedeOthers(session.user_id, ref);
    } else result = "ignored";
  } else if ((e.event === "CHECKOUT_CANCELED" || e.event === "CHECKOUT_EXPIRED") && e.checkout) {
    await db.from("checkout_sessions").update({ status: e.event === "CHECKOUT_CANCELED" ? "canceled" : "expired" }).eq("id", e.checkout.id).eq("status", "pending");
  } else if (e.event === "SUBSCRIPTION_CREATED" && e.subscription) {
    // a assinatura nasce do checkout pago: troca o id provisório pelo da Asaas
    const { data } = await db.from("subscriptions").update({ provider_subscription_id: e.subscription.id })
      .eq("provider", "asaas").eq("provider_customer_id", e.subscription.customer).like("provider_subscription_id", "pending:%").select("user_id");
    userId = data?.[0]?.user_id ?? null;
    if (!userId) result = "ignored";
  } else if ((e.event === "SUBSCRIPTION_DELETED" || e.event === "SUBSCRIPTION_INACTIVATED") && e.subscription) {
    const { data } = await db.from("subscriptions").update({ status: "canceled", cancel_at_period_end: true })
      .eq("provider_subscription_id", e.subscription.id).select("user_id");
    userId = data?.[0]?.user_id ?? null;
  } else if (e.payment?.subscription && ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"].includes(e.event)) {
    const paid = e.event === "PAYMENT_CONFIRMED" || e.event === "PAYMENT_RECEIVED";
    // F1: cobrança de um período que começa depois do cancelamento volta sozinha para a pessoa
    const { data: current } = await db.from("subscriptions").select("user_id, canceled_at, plan").eq("provider_subscription_id", e.payment.subscription).maybeSingle();
    if (paid && current?.canceled_at && e.payment.dueDate && e.payment.dueDate > current.canceled_at.slice(0, 10)) {
      await asaas(`/payments/${e.payment.id}/refund`, { method: "POST", body: JSON.stringify({ description: "Cobrança depois do cancelamento" }) });
      await db.from("notices").insert({ user_id: current.user_id, kind: "billing", title: "Cobrança estornada",
        body: "Chegou uma cobrança depois do seu cancelamento. Já pedimos o estorno à Asaas; o valor volta no mesmo meio de pagamento." });
      await db.from("billing_events").update({ processed_at: new Date().toISOString(), user_id: current.user_id }).eq("id", row.id);
      return "ok";
    }
    const months = current ? planById(await loadPlans(), current.plan)?.months ?? 1 : 1;
    const patch = paid
      ? { status: "active", ...(e.payment.dueDate ? { current_period_end: addMonths(e.payment.dueDate, months) } : {}) }
      : { status: e.event === "PAYMENT_OVERDUE" ? "past_due" : "unpaid" };
    const { data } = await db.from("subscriptions").update(patch).eq("provider_subscription_id", e.payment.subscription).select("user_id");
    userId = data?.[0]?.user_id ?? null;
  } else result = "ignored";

  await db.from("billing_events").update({ processed_at: new Date().toISOString(), user_id: userId }).eq("id", row.id);
  return result;
}

// F2: a pessoa voltou da página de pagamento (successUrl). Marca a volta no checkout das
// últimas 2 h; o getSettings libera o acesso por 2 h a partir daqui, até o webhook confirmar.
export async function markCheckoutReturned(userId: string) {
  const db = getAdmin();
  const { data: session } = await db.from("checkout_sessions").select("id").eq("user_id", userId).eq("status", "pending").is("returned_at", null)
    .gte("created_at", new Date(Date.now() - 2 * 3_600_000).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (session) await db.from("checkout_sessions").update({ returned_at: new Date().toISOString() }).eq("id", session.id);
}
