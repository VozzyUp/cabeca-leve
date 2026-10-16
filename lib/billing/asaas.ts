import crypto from "node:crypto";
import { BRAND } from "@/lib/brand";
import { sendEmail } from "@/lib/email";
import { newProtocol } from "@/lib/support";
import { forgetLock } from "@/lib/plan-lock";
import { planById, type PayMethod } from "@/lib/plans";
import { loadPlans } from "@/lib/plans-server";
import { getAdmin } from "@/lib/supabase/server";

// Cobrança pela Asaas (https://docs.asaas.com), tudo pela API: a pessoa paga numa tela do próprio app (Pix, boleto ou cartão)
// e nunca vê a Asaas. Cada plano do catálogo (Administração > Planos) escolhe a forma de renovar:
// - Cartão em plano que renova sozinho (recurring): assinatura (POST /subscriptions), ciclo pela duração do plano.
// - Todo o resto (Pix, boleto, ou cartão em plano sem renovação): cobrança única (POST /payments) que libera `months` meses.
// Os dados do cartão passam pelo nosso servidor só no instante de chamar a Asaas: não são gravados nem entram em log.
// O estado da assinatura vive no banco e muda pelo webhook (app/api/webhooks/asaas); o cartão aprovado na hora libera sem esperar.

const api = () => process.env.ASAAS_API_URL ?? "https://api-sandbox.asaas.com/v3";
export const billingEnabled = () => !!process.env.ASAAS_API_KEY;

// Erro da Asaas com o que ela respondeu: 4xx traz `errors` com a descrição em português, que serve para mostrar à pessoa
export class AsaasError extends Error {
  constructor(public path: string, public status: number, public body: string) {
    super(`asaas ${path}: ${status} ${body.slice(0, 300)}`);
  }
  get descriptions(): string[] {
    try { return ((JSON.parse(this.body) as { errors?: Array<{ description?: string }> }).errors ?? []).map((e) => e.description ?? "").filter(Boolean); } catch { return []; }
  }
}

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(`${api()}${path}`, {
    ...init, headers: { "Content-Type": "application/json", access_token: process.env.ASAAS_API_KEY ?? "", "User-Agent": "assistente-pessoal-ia", ...init.headers },
  });
  if (!res.ok) throw new AsaasError(path, res.status, await res.text());
  return res.json();
}

const saoPauloDate = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(d);

const CYCLE = { 1: "MONTHLY", 3: "QUARTERLY", 6: "SEMIANNUALLY", 12: "YEARLY" } as const;
const METHOD_TYPE = { pix: "PIX", boleto: "BOLETO", card: "CREDIT_CARD" } as const;
const MAX_ATTEMPTS_PER_HOUR = 8;

export class PlanUnavailableError extends Error {}

export type Payer = { name: string; cpfCnpj: string; phone: string; postalCode?: string; addressNumber?: string };
export type CardData = { holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string };
export type AttemptInfo = {
  value: number; dueDate: string; renews: boolean;
  pix?: { payload: string; image: string; expiresAt: string | null };
  boleto?: { line: string; url: string | null };
};
export type PayResult =
  | { ok: true; attemptId: string; status: "paid" | "pending"; method: PayMethod; info: AttemptInfo }
  | { ok: false; error: string };

const onlyDigits = (t: string) => t.replace(/\D/g, "");
const phoneDigits = (t: string) => onlyDigits(t).replace(/^55(?=\d{10,11}$)/, "");
const GENERIC_REFUSAL = "O pagamento não foi aprovado. Confira os dados do cartão ou tente outro cartão.";

// A pessoa na Asaas: um cadastro por conta, atualizado a cada tentativa. Avisos da Asaas por e-mail ficam desligados: o app mostra tudo.
async function ensureCustomer(userId: string, email: string, payer: Payer): Promise<string> {
  const db = getAdmin();
  const body = JSON.stringify({
    name: payer.name, email, cpfCnpj: onlyDigits(payer.cpfCnpj), mobilePhone: phoneDigits(payer.phone),
    ...(payer.postalCode ? { postalCode: onlyDigits(payer.postalCode) } : {}), ...(payer.addressNumber ? { addressNumber: payer.addressNumber } : {}),
    externalReference: userId, notificationDisabled: true,
  });
  const { data: row } = await db.from("billing_customers").select("customer_id").eq("user_id", userId).maybeSingle();
  if (row) {
    try {
      await asaas(`/customers/${row.customer_id}`, { method: "PUT", body });
      return row.customer_id;
    } catch (error) {
      if (!(error instanceof AsaasError) || error.status !== 404) throw error;  // cadastro apagado na Asaas: cria outro
    }
  }
  const { id } = (await asaas("/customers", { method: "POST", body })) as { id: string };
  const { error } = await db.from("billing_customers").upsert({ user_id: userId, customer_id: id });
  if (error) throw new Error(error.message);
  return id;
}

type Attempt = { id: string; plan: string; method: PayMethod; kind: "payment" | "subscription"; status: string; failure?: string | null; info: AttemptInfo };

async function saveAttempt(userId: string, a: Attempt) {
  const { error } = await getAdmin().from("checkout_sessions").insert({ id: a.id, user_id: userId, plan: a.plan, method: a.method, kind: a.kind, status: a.status, failure: a.failure ?? null, info: a.info as never });
  if (error) throw new Error(error.message);
}

// Paga o plano pelo método escolhido. Recusa do banco/Asaas (4xx) volta como `error` em português; falha nossa ou de configuração (401, 5xx) sobe como exceção.
export async function payPlan(args: {
  userId: string; email: string; plan: string; method: PayMethod; payer: Payer; card?: CardData; remoteIp: string; trialEndsOn: string | null;
}): Promise<PayResult> {
  const { userId, plan, method } = args;
  const p = planById(await loadPlans(), plan);
  if (!p || p.kind !== "paid" || !p.active) throw new PlanUnavailableError("Plano indisponível");
  if (method === "card" && !args.card) return { ok: false, error: "Preencha os dados do cartão." };
  const db = getAdmin();
  const { count } = await db.from("checkout_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("kind", "checkout")
    .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= MAX_ATTEMPTS_PER_HOUR) return { ok: false, error: "Muitas tentativas seguidas. Espere um pouco e tente de novo, ou fale com a gente." };

  const today = saoPauloDate(new Date());
  const subscription = method === "card" && p.recurring;
  const renews = subscription;
  const value = p.priceCents / 100;
  const description = `Plano ${p.name.toLowerCase()} - ${BRAND.name}`;
  const base = { plan, method };
  const failAttempt = async (failure: string) => {
    // a tentativa recusada fica registrada (limite por hora e histórico), sem nenhum dado do cartão
    await saveAttempt(userId, { ...base, id: `falha_${crypto.randomUUID()}`, kind: subscription ? "subscription" : "payment", status: "failed", failure, info: { value, dueDate: today, renews } });
    return { ok: false, error: failure } as const;
  };

  try {
    const customer = await ensureCustomer(userId, args.email, args.payer);
    const holder = args.card ? {
      creditCard: { holderName: args.card.holderName, number: onlyDigits(args.card.number), expiryMonth: args.card.expiryMonth, expiryYear: args.card.expiryYear, ccv: args.card.ccv },
      creditCardHolderInfo: {
        name: args.payer.name, email: args.email, cpfCnpj: onlyDigits(args.payer.cpfCnpj), postalCode: onlyDigits(args.payer.postalCode ?? ""),
        addressNumber: args.payer.addressNumber ?? "", mobilePhone: phoneDigits(args.payer.phone),
      },
      remoteIp: args.remoteIp,
    } : {};

    if (subscription) {
      // quem ainda está no teste grátis só paga a 1ª mensalidade quando o teste acaba
      const firstDue = args.trialEndsOn && args.trialEndsOn > today ? args.trialEndsOn : today;
      const sub = (await asaas("/subscriptions", { method: "POST", body: JSON.stringify({
        customer, billingType: "CREDIT_CARD", value, nextDueDate: firstDue, cycle: CYCLE[p.months], description, externalReference: userId, ...holder,
      }) })) as { id: string };
      const info: AttemptInfo = { value, dueDate: firstDue, renews: true };
      await saveAttempt(userId, { ...base, id: sub.id, kind: "subscription", status: "pending", info });
      await activateAttempt(userId, sub.id, { ref: sub.id, months: p.months, once: false, customer, from: firstDue });
      return { ok: true, attemptId: sub.id, status: "paid", method, info };
    }

    const dueDate = method === "boleto" ? saoPauloDate(new Date(Date.now() + 3 * 86_400_000)) : today;
    const pay = (await asaas("/payments", { method: "POST", body: JSON.stringify({
      customer, billingType: METHOD_TYPE[method], value, dueDate, description, externalReference: userId, ...holder,
    }) })) as { id: string; status?: string; bankSlipUrl?: string };
    const info: AttemptInfo = { value, dueDate, renews: false };
    if (method === "pix") {
      const q = (await asaas(`/payments/${pay.id}/pixQrCode`)) as { payload: string; encodedImage: string; expirationDate?: string };
      info.pix = { payload: q.payload, image: q.encodedImage, expiresAt: q.expirationDate ?? null };
    } else if (method === "boleto") {
      const b = (await asaas(`/payments/${pay.id}/identificationField`)) as { identificationField: string };
      info.boleto = { line: b.identificationField, url: pay.bankSlipUrl ?? null };
    }
    const approved = pay.status === "CONFIRMED" || pay.status === "RECEIVED";
    await saveAttempt(userId, { ...base, id: pay.id, kind: "payment", status: "pending", info });
    if (approved) await activateAttempt(userId, pay.id, { ref: `payment:${pay.id}`, months: p.months, once: true, customer, from: today });
    return { ok: true, attemptId: pay.id, status: approved ? "paid" : "pending", method, info };
  } catch (error) {
    if (error instanceof AsaasError && error.status === 400) {
      const text = error.descriptions.join(" ");
      return failAttempt(text || (method === "card" ? GENERIC_REFUSAL : "Não foi possível gerar a cobrança. Confira os dados e tente de novo."));
    }
    throw error;
  }
}

// Libera o plano (cartão aprovado na hora ou webhook de pagamento confirmado). Repetir não faz mal: o upsert é pela referência.
async function activateAttempt(userId: string, attemptId: string, o: { ref: string; months: number; once: boolean; customer: string; from: string }) {
  const db = getAdmin();
  const { data: attempt } = await db.from("checkout_sessions").select("plan, status").eq("id", attemptId).maybeSingle();
  if (!attempt) return;
  const { error } = await db.from("subscriptions").upsert({
    user_id: userId, provider: "asaas", provider_customer_id: o.customer, provider_subscription_id: o.ref, plan: attempt.plan, status: "active",
    current_period_end: addMonths(o.from, o.months), cancel_at_period_end: o.once,
  }, { onConflict: "provider_subscription_id" });
  if (error) throw new Error(error.message);
  await db.from("checkout_sessions").update({ status: "paid", failure: null }).eq("id", attemptId);
  await supersedeOthers(userId, o.ref);
  forgetLock(userId);
  if (attempt.status !== "paid") {
    await db.from("notices").insert({ user_id: userId, kind: "billing", title: "Pagamento aprovado", body: "Seu plano está ativo. Obrigado!", href: "/ajustes/plano" });
  }
}

// A tela de pagamento pergunta aqui até o Pix ou o boleto ser pago (ou dar errado)
export async function attemptStatus(userId: string, id: string) {
  const { data } = await getAdmin().from("checkout_sessions").select("status, failure, method, info").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return { status: data.status as "pending" | "paid" | "failed" | "canceled" | "expired", failure: data.failure, method: data.method as PayMethod | null, info: data.info as unknown as AttemptInfo };
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

const PAYMENT_EVENTS = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", "PAYMENT_REPROVED_BY_RISK_ANALYSIS"];

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
  } else if (e.payment && !e.payment.subscription && PAYMENT_EVENTS.includes(e.event)) {
    // cobrança única criada pelo app (Pix, boleto ou cartão): a tentativa guarda a conta e o plano
    const { data: attempt } = await db.from("checkout_sessions").select("user_id, status").eq("id", e.payment.id).eq("kind", "payment").maybeSingle();
    if (!attempt) result = "ignored";
    else {
      userId = attempt.user_id;
      const ref = `payment:${e.payment.id}`;
      if (e.event === "PAYMENT_CONFIRMED" || e.event === "PAYMENT_RECEIVED") {
        const { data: bought } = await db.from("checkout_sessions").select("plan").eq("id", e.payment.id).single();
        const months = planById(await loadPlans(), bought?.plan ?? "")?.months ?? 1;
        await activateAttempt(attempt.user_id, e.payment.id, { ref, months, once: true, customer: e.payment.customer, from: new Date().toISOString().slice(0, 10) });
      } else if (e.event === "PAYMENT_OVERDUE") {
        await db.from("checkout_sessions").update({ status: "expired" }).eq("id", e.payment.id).eq("status", "pending");   // vencido; se pagarem depois, o evento de pagamento ainda libera
      } else if (e.event === "PAYMENT_REFUNDED" || e.event === "PAYMENT_CHARGEBACK_REQUESTED" || e.event === "PAYMENT_DELETED") {
        await db.from("checkout_sessions").update({ status: "canceled" }).eq("id", e.payment.id);
        if (attempt.status === "paid") await db.from("subscriptions").update({ status: "canceled", current_period_end: new Date().toISOString() }).eq("provider_subscription_id", ref);
      } else {
        await db.from("checkout_sessions").update({ status: "failed", failure: "O pagamento não foi aprovado. Tente outro cartão ou outra forma de pagamento." }).eq("id", e.payment.id);
      }
    }
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
