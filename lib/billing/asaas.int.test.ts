import { createClient } from "@supabase/supabase-js";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSupabaseStore } from "@/lib/data/supabase-store";
import type { Database } from "@/lib/supabase/database.types";

// Cobrança pela Asaas contra uma API falsa e o Supabase local.
// SUPABASE_TEST=1 npx vitest run lib/billing/asaas.int.test.ts
const run = process.env.SUPABASE_TEST === "1";
const TOKEN = "token-do-webhook-com-mais-de-32-caracteres";

describe.skipIf(!run)("Asaas", () => {
  const calls: Array<{ method: string; url: string; body: Record<string, unknown> | null }> = [];
  let server: http.Server;
  let userId = "";
  const admin = createClient<Database>("http://127.0.0.1:54321", (process.env.SUPABASE_SECRET_KEY ?? ""), { auth: { persistSession: false } });
  const runId = Date.now();  // eventos ficam no banco entre execuções: ids únicos por execução
  const payer = { name: "Maria da Silva", cpfCnpj: "529.982.247-25", phone: "(11) 91234-5678", postalCode: "01310-100", addressNumber: "100" };
  const card = { holderName: "MARIA DA SILVA", number: "4111 1111 1111 1111", expiryMonth: "12", expiryYear: "2030", ccv: "123" };
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date());
  const pay = async (plan: string, method: "pix" | "boleto" | "card", extra: { card?: typeof card; trialEndsOn?: string | null } = {}) => {
    const { payPlan } = await import("./asaas");
    return payPlan({ userId, email: "maria@teste.local", plan, method, payer, card: method === "card" ? (extra.card ?? card) : undefined, remoteIp: "203.0.113.9", trialEndsOn: extra.trialEndsOn ?? null });
  };
  const evt = (id: string, event: string, extra: object) => ({ id: `${id}_${runId}`, event, dateCreated: "2026-10-08 10:00:00", ...extra });

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        const body = data ? JSON.parse(data) : null;
        calls.push({ method: req.method!, url: req.url!, body });
        res.setHeader("content-type", "application/json");
        const refuse = (description: string) => { res.statusCode = 400; res.end(JSON.stringify({ errors: [{ code: "invalid_object", description }] })); };
        if (req.url === "/v3/customers") return res.end(JSON.stringify({ id: `cus_fake_${runId}` }));
        if (req.url!.startsWith("/v3/customers/")) return res.end(JSON.stringify({ id: req.url!.split("/").pop() }));
        if (req.url === "/v3/subscriptions" || req.url === "/v3/payments") {
          if (body?.creditCard?.number === "4000000000000002") return refuse("Transação não autorizada. Use outro cartão.");
          if (req.url === "/v3/subscriptions") return res.end(JSON.stringify({ id: `sub_fake_${runId}_${calls.length}` }));
          return res.end(JSON.stringify({ id: `pay_fake_${runId}_${calls.length}`, status: body.billingType === "CREDIT_CARD" ? "CONFIRMED" : "PENDING", bankSlipUrl: "https://example.com/b.pdf" }));
        }
        if (req.url!.endsWith("/pixQrCode")) return res.end(JSON.stringify({ payload: "pix-copia-e-cola", encodedImage: "AAAA", expirationDate: "2026-12-31 23:59:59" }));
        if (req.url!.endsWith("/identificationField")) return res.end(JSON.stringify({ identificationField: "23793.38128 60000.000003" }));
        res.end(JSON.stringify({ deleted: true }));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      SUPABASE_SECRET_KEY: (process.env.SUPABASE_SECRET_KEY ?? ""), ASAAS_API_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v3`,
      ASAAS_API_KEY: "teste", ASAAS_WEBHOOK_TOKEN: TOKEN, NEXT_PUBLIC_SITE_URL: "https://app.exemplo.com.br",
    });
    delete process.env.ANTHROPIC_API_KEY;
    const { data } = await admin.auth.admin.createUser({ email: `asaas-${Date.now()}@teste.local`, password: "x".repeat(12), email_confirm: true });
    userId = data.user!.id;
  });
  afterAll(async () => {
    server.close();
    await admin.auth.admin.deleteUser(userId);
  });
  const reset = async () => { await admin.from("subscriptions").delete().eq("user_id", userId); await admin.from("checkout_sessions").delete().eq("user_id", userId); };

  it("webhook sem o token certo é recusado", async () => {
    const { verifyAsaasWebhook } = await import("./asaas");
    expect(verifyAsaasWebhook(new Headers({ "asaas-access-token": TOKEN }))).toBe(true);
    expect(verifyAsaasWebhook(new Headers({ "asaas-access-token": "errado" }))).toBe(false);
    expect(verifyAsaasWebhook(new Headers())).toBe(false);
  });

  it("mensal no cartão: assinatura pela API, libera na hora, renova e atrasa pelo webhook", async () => {
    const { handleAsaasEvent } = await import("./asaas");
    const r = await pay("monthly", "card");
    expect(r).toMatchObject({ ok: true, status: "paid", method: "card" });
    const sent = calls.filter((c) => c.url === "/v3/subscriptions").at(-1)!.body!;
    expect(sent).toMatchObject({
      customer: `cus_fake_${runId}`, billingType: "CREDIT_CARD", value: 39.9, cycle: "MONTHLY", nextDueDate: today, externalReference: userId, remoteIp: "203.0.113.9",
      creditCard: { number: "4111111111111111", expiryMonth: "12", expiryYear: "2030", ccv: "123" },
      creditCardHolderInfo: { cpfCnpj: "52998224725", postalCode: "01310100", addressNumber: "100", mobilePhone: "11912345678" },
    });
    expect(calls.find((c) => c.url === "/v3/customers")!.body).toMatchObject({ cpfCnpj: "52998224725", notificationDisabled: true, externalReference: userId });
    const store = await createSupabaseStore(admin, userId, null);
    const s = await store.getSettings();
    expect(s.plan).toBe("monthly");
    expect(s.billing).toMatchObject({ renews: true, pastDue: false });

    const sub = (r as { attemptId: string }).attemptId;
    expect(await handleAsaasEvent(evt("evt_3", "PAYMENT_RECEIVED", { payment: { id: "pay_1", customer: `cus_fake_${runId}`, subscription: sub, dueDate: "2026-10-08" } }))).toBe("ok");
    expect((await store.getSettings()).billing!.periodEnd!.slice(0, 10)).toBe("2026-11-08");
    await handleAsaasEvent(evt("evt_4", "PAYMENT_OVERDUE", { payment: { id: "pay_2", customer: `cus_fake_${runId}`, subscription: sub } }));
    expect((await store.getSettings()).billing!.pastDue).toBe(true);
    // o cartão nunca fica guardado
    const { data: rows } = await admin.from("checkout_sessions").select("*").eq("user_id", userId);
    expect(JSON.stringify(rows)).not.toContain("4111");
  });

  it("cancelar para de cobrar na Asaas e mantém o acesso até o fim do período", async () => {
    const { cancelSubscription } = await import("./asaas");
    expect(await cancelSubscription(userId)).toBe(true);
    expect(calls.at(-1)).toMatchObject({ method: "DELETE" });
    expect(calls.at(-1)!.url).toMatch(/^\/v3\/subscriptions\/sub_fake_/);
    const s = await (await createSupabaseStore(admin, userId, null)).getSettings();
    expect(s.plan).toBe("monthly");
    expect(s.billing!.renews).toBe(false);
  });

  it("cadastro reaproveitado: a segunda tentativa atualiza a pessoa na Asaas em vez de criar outra", async () => {
    await reset();
    await pay("yearly", "pix");
    const last = calls.filter((c) => c.url.startsWith("/v3/customers")).at(-1)!;
    expect(last).toMatchObject({ method: "PUT", url: `/v3/customers/cus_fake_${runId}` });
  });

  it("anual no Pix: gera o QR, fica aguardando e o webhook libera 12 meses", async () => {
    const { handleAsaasEvent, attemptStatus } = await import("./asaas");
    await reset();
    const r = await pay("yearly", "pix");
    expect(r).toMatchObject({ ok: true, status: "pending", method: "pix", info: { value: 359, pix: { payload: "pix-copia-e-cola" } } });
    const id = (r as { attemptId: string }).attemptId;
    expect(calls.filter((c) => c.url === "/v3/payments").at(-1)!.body).toMatchObject({ billingType: "PIX", value: 359, dueDate: today });
    expect((await admin.from("subscriptions").select("id").eq("user_id", userId)).data).toEqual([]);   // ainda não pagou: nada liberado
    expect(await attemptStatus(userId, id)).toMatchObject({ status: "pending" });
    expect(await attemptStatus("00000000-0000-0000-0000-000000000000", id)).toBeNull();   // outra conta não enxerga

    expect(await handleAsaasEvent(evt("evt_pix", "PAYMENT_RECEIVED", { payment: { id, customer: `cus_fake_${runId}` } }))).toBe("ok");
    expect(await handleAsaasEvent(evt("evt_pix", "PAYMENT_RECEIVED", { payment: { id, customer: `cus_fake_${runId}` } }))).toBe("duplicate");
    const { data } = await admin.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end").eq("user_id", userId).single();
    expect(data).toMatchObject({ plan: "yearly", status: "active", cancel_at_period_end: true });
    expect(new Date(data!.current_period_end!).getTime() - Date.now()).toBeGreaterThan(360 * 86_400_000);
    expect(await attemptStatus(userId, id)).toMatchObject({ status: "paid" });
  });

  it("boleto: vence em 3 dias, mostra a linha digitável e o pagamento depois do vencimento ainda libera", async () => {
    const { handleAsaasEvent, attemptStatus } = await import("./asaas");
    await reset();
    const r = await pay("monthly", "boleto");
    expect(r).toMatchObject({ ok: true, status: "pending", info: { boleto: { line: "23793.38128 60000.000003", url: "https://example.com/b.pdf" } } });
    const id = (r as { attemptId: string }).attemptId;
    const due = new Date(Date.now() + 3 * 86_400_000);
    expect(calls.filter((c) => c.url === "/v3/payments").at(-1)!.body!.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((r as { info: { dueDate: string } }).info.dueDate >= today && (r as { info: { dueDate: string } }).info.dueDate <= new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(due)).toBe(true);
    await handleAsaasEvent(evt("evt_b1", "PAYMENT_OVERDUE", { payment: { id, customer: "c" } }));
    expect(await attemptStatus(userId, id)).toMatchObject({ status: "expired" });
    await handleAsaasEvent(evt("evt_b2", "PAYMENT_RECEIVED", { payment: { id, customer: `cus_fake_${runId}` } }));
    expect(await attemptStatus(userId, id)).toMatchObject({ status: "paid" });
    const s = await (await createSupabaseStore(admin, userId, null)).getSettings();
    expect(s.plan).toBe("monthly");
    expect(s.billing).toMatchObject({ renews: false });   // Pix e boleto pagam um período, sem renovar
  });

  it("cartão recusado: volta o motivo em português, registra a falha e não libera nada", async () => {
    await reset();
    const r = await pay("monthly", "card", { card: { ...card, number: "4000000000000002" } });
    expect(r).toEqual({ ok: false, error: "Transação não autorizada. Use outro cartão." });
    const { data } = await admin.from("checkout_sessions").select("status, failure, method").eq("user_id", userId);
    expect(data).toEqual([{ status: "failed", failure: "Transação não autorizada. Use outro cartão.", method: "card" }]);
    expect(JSON.stringify(data)).not.toContain("4000");
    expect((await admin.from("subscriptions").select("id").eq("user_id", userId)).data).toEqual([]);
  });

  it("falha da Asaas (fora do 400) sobe como exceção e não deixa tentativa nem plano", async () => {
    await reset();
    const saved = process.env.ASAAS_API_URL;
    process.env.ASAAS_API_URL = "http://127.0.0.1:1/v3";   // ninguém escuta
    try { await expect(pay("monthly", "pix")).rejects.toThrow(); } finally { process.env.ASAAS_API_URL = saved; }
    expect((await admin.from("checkout_sessions").select("id").eq("user_id", userId)).data).toEqual([]);
  });

  it("limite de tentativas por hora segura quem fica testando cartões", async () => {
    await reset();
    for (let i = 0; i < 8; i++) await pay("monthly", "card", { card: { ...card, number: "4000000000000002" } });
    const r = await pay("monthly", "card");
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Muitas tentativas/) });
    await reset();
  });

  it("quem está no teste grátis paga a primeira mensalidade só no fim do teste", async () => {
    await reset();
    const end = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await pay("monthly", "card", { trialEndsOn: end });
    expect(calls.filter((c) => c.url === "/v3/subscriptions").at(-1)!.body!.nextDueDate).toBe(end);
    await reset();
  });

  it("plano criado pelo time: ciclo e duração seguem o plano, e o valor vem do banco", async () => {
    const { handleAsaasEvent, PlanUnavailableError } = await import("./asaas");
    await reset();
    const planId = `trimestral-${runId}`;
    await admin.from("plans").insert({ id: planId, name: "Trimestral", kind: "paid", price_cents: 9900, months: 3, recurring: true, whatsapp_limit: 4, messages_per_day: 300, storage_mb: 1000, sort: 900 });
    try {
      const r = await pay(planId, "card");
      expect(calls.filter((c) => c.url === "/v3/subscriptions").at(-1)!.body).toMatchObject({ value: 99, cycle: "QUARTERLY", description: "Plano trimestral - Peraí" });
      await handleAsaasEvent(evt("evt_t3", "PAYMENT_RECEIVED", { payment: { id: "pay_t", customer: `cus_fake_${runId}`, subscription: (r as { attemptId: string }).attemptId, dueDate: "2026-10-08" } }));
      const s = await (await createSupabaseStore(admin, userId, null)).getSettings();
      expect(s.plan).toBe(planId);
      expect(s.planInfo).toMatchObject({ whatsappLimit: 4, messagesPerDay: 300, storageMb: 1000, months: 3 });
      expect(s.billing!.periodEnd!.slice(0, 10)).toBe("2027-01-08");  // renovação de 3 meses
      // no Pix, o mesmo plano vira pagamento único
      await reset();
      await pay(planId, "pix");
      expect(calls.filter((c) => c.url === "/v3/payments").at(-1)!.body).toMatchObject({ billingType: "PIX", value: 99 });
      // fora de venda, não abre pagamento novo
      await admin.from("plans").update({ active: false }).eq("id", planId);
      await expect(pay(planId, "pix")).rejects.toBeInstanceOf(PlanUnavailableError);
      await expect(pay("trial", "pix")).rejects.toBeInstanceOf(PlanUnavailableError);
      await expect(pay("nao-existe", "pix")).rejects.toBeInstanceOf(PlanUnavailableError);
    } finally {
      await reset();
      await admin.from("plans").delete().eq("id", planId);
    }
  });

  it("trocar de plano encerra a cobrança do anterior para não pagar dois", async () => {
    const { handleAsaasEvent } = await import("./asaas");
    await reset();
    await admin.from("subscriptions").insert({ user_id: userId, provider: "asaas", provider_customer_id: `cus_4_${runId}`, provider_subscription_id: `sub_velha_${runId}`, plan: "monthly", status: "active", current_period_end: "2099-01-01T00:00:00Z" });
    const r = await pay("yearly", "pix");
    await handleAsaasEvent(evt("evt_s1", "PAYMENT_RECEIVED", { payment: { id: (r as { attemptId: string }).attemptId, customer: `cus_fake_${runId}` } }));
    expect(calls.some((c) => c.method === "DELETE" && c.url === `/v3/subscriptions/sub_velha_${runId}`)).toBe(true);
    const { data } = await admin.from("subscriptions").select("plan, status").eq("user_id", userId);
    expect(data).toEqual(expect.arrayContaining([expect.objectContaining({ plan: "monthly", status: "canceled" }), expect.objectContaining({ plan: "yearly", status: "active" })]));
    const s = await (await createSupabaseStore(admin, userId, null)).getSettings();
    expect(s.plan).toBe("yearly");
    expect(s.billing).toMatchObject({ renews: false });
    await reset();
  });

  it("pagamento de uma cobrança que não é nossa é ignorado", async () => {
    const { handleAsaasEvent } = await import("./asaas");
    expect(await handleAsaasEvent(evt("evt_x", "PAYMENT_RECEIVED", { payment: { id: "pay_de_outro_sistema", customer: "c" } }))).toBe("ignored");
  });

  it("sem plano e com o teste vencido, o assistente explica e não roda", async () => {
    const { respond } = await import("@/lib/assistant");
    const { createSupabaseStore } = await import("@/lib/data/supabase-store");
    await admin.from("subscriptions").delete().eq("user_id", userId);
    await admin.from("profiles").update({ trial_ends_on: "2026-01-01" }).eq("user_id", userId);
    const store = await createSupabaseStore(admin, userId, null);
    const { reply } = await respond(store, "gastei 10 no café", { channel: "web" });
    expect(reply.text).toMatch(/teste grátis terminou/);
    expect(await store.listTransactions()).toEqual([]);
  });
});
