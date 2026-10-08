import crypto from "node:crypto";
import { PLANS } from "@/lib/plans";
import { getAdmin } from "@/lib/supabase/server";

// Cobrança pela Asaas (https://docs.asaas.com). Página de pagamento hospedada por eles:
// nenhum dado de cartão passa pelo nosso servidor.
// - Mensal: assinatura recorrente no cartão (Checkout RECURRENT, ciclo MONTHLY).
// - Anual: pagamento único por Pix ou cartão que libera 12 meses (Checkout DETACHED).
// O estado da assinatura vive no banco e só muda pelo webhook (app/api/webhooks/asaas).

const api = () => process.env.ASAAS_API_URL ?? "https://api-sandbox.asaas.com/v3";
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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

export async function createCheckout(userId: string, plan: "monthly" | "yearly", trialEndsOn: string | null) {
  const p = PLANS[plan];
  const callback = { successUrl: `${site()}/planos/obrigado`, cancelUrl: `${site()}/planos`, expiredUrl: `${site()}/planos?expirou=1` };
  const items = [{ name: `Plano ${p.name.toLowerCase()}`, description: "Assistente pessoal com IA", quantity: 1, value: p.priceCents / 100 }];
  // quem ainda está no teste grátis só paga a 1ª mensalidade quando o teste acaba
  const firstDue = trialEndsOn && trialEndsOn > new Date().toISOString().slice(0, 10) ? new Date(`${trialEndsOn}T12:00:00-03:00`) : new Date();
  const body = plan === "monthly"
    ? { billingTypes: ["CREDIT_CARD"], chargeTypes: ["RECURRENT"], minutesToExpire: 60, callback, items, externalReference: userId,
        subscription: { cycle: "MONTHLY", nextDueDate: asaasDate(firstDue) } }
    : { billingTypes: ["PIX", "CREDIT_CARD"], chargeTypes: ["DETACHED"], minutesToExpire: 60, callback, items, externalReference: userId };
  const { id } = (await asaas("/checkouts", { method: "POST", body: JSON.stringify(body) })) as { id: string };
  const { error } = await getAdmin().from("checkout_sessions").insert({ id, user_id: userId, plan });
  if (error) throw new Error(error.message);
  return checkoutUrl(id);
}

export async function cancelSubscription(userId: string) {
  const db = getAdmin();
  const { data: sub } = await db.from("subscriptions").select("id, provider_subscription_id").eq("user_id", userId)
    .in("status", ["active", "past_due", "trialing"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!sub) return false;
  // anual é pagamento único: não há cobrança futura para cancelar, só não renova
  if (sub.provider_subscription_id.startsWith("sub_")) await asaas(`/subscriptions/${sub.provider_subscription_id}`, { method: "DELETE" });
  await db.from("subscriptions").update({ cancel_at_period_end: true }).eq("id", sub.id);
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
      const yearly = session.plan === "yearly";
      await db.from("subscriptions").upsert({
        user_id: session.user_id, provider: "asaas", provider_customer_id: e.checkout.customer ?? "",
        provider_subscription_id: `${yearly ? "checkout" : "pending"}:${e.checkout.id}`, plan: session.plan, status: "active",
        current_period_end: addMonths(new Date().toISOString().slice(0, 10), yearly ? 12 : 1), cancel_at_period_end: yearly,
      }, { onConflict: "provider_subscription_id" });
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
    const patch = paid
      ? { status: "active", ...(e.payment.dueDate ? { current_period_end: addMonths(e.payment.dueDate, 1) } : {}) }
      : { status: e.event === "PAYMENT_OVERDUE" ? "past_due" : "unpaid" };
    const { data } = await db.from("subscriptions").update(patch).eq("provider_subscription_id", e.payment.subscription).select("user_id");
    userId = data?.[0]?.user_id ?? null;
  } else result = "ignored";

  await db.from("billing_events").update({ processed_at: new Date().toISOString(), user_id: userId }).eq("id", row.id);
  return result;
}
