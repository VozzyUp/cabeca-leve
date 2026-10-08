import { createClient } from "@supabase/supabase-js";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  const evt = (id: string, event: string, extra: object) => ({ id: `${id}_${runId}`, event, dateCreated: "2026-10-08 10:00:00", ...extra });

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        calls.push({ method: req.method!, url: req.url!, body: data ? JSON.parse(data) : null });
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(req.url === "/v3/checkouts" ? { id: `chk_${Date.now()}_${calls.length}` } : { deleted: true }));
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

  it("webhook sem o token certo é recusado", async () => {
    const { verifyAsaasWebhook } = await import("./asaas");
    expect(verifyAsaasWebhook(new Headers({ "asaas-access-token": TOKEN }))).toBe(true);
    expect(verifyAsaasWebhook(new Headers({ "asaas-access-token": "errado" }))).toBe(false);
    expect(verifyAsaasWebhook(new Headers())).toBe(false);
  });

  it("mensal: checkout, pagamento, assinatura e mensalidade", async () => {
    const { createCheckout, handleAsaasEvent } = await import("./asaas");
    const { createSupabaseStore } = await import("@/lib/data/supabase-store");
    const url = await createCheckout(userId, "monthly", null);
    const checkoutId = url.split("id=")[1];
    expect(url).toMatch(/^https:\/\/asaas\.com\/checkoutSession\/show\?id=chk_/);
    const sentBody = calls.at(-1)!.body!;
    expect(sentBody).toMatchObject({ billingTypes: ["CREDIT_CARD"], chargeTypes: ["RECURRENT"], externalReference: userId,
      items: [{ value: 39.9 }], callback: { successUrl: "https://app.exemplo.com.br/planos/obrigado" } });

    expect(await handleAsaasEvent(evt("evt_1", "CHECKOUT_PAID", { checkout: { id: checkoutId, customer: `cus_1_${runId}` } }))).toBe("ok");
    expect(await handleAsaasEvent(evt("evt_1", "CHECKOUT_PAID", { checkout: { id: checkoutId, customer: `cus_1_${runId}` } }))).toBe("duplicate");
    expect(await handleAsaasEvent(evt("evt_2", "SUBSCRIPTION_CREATED", { subscription: { id: `sub_abc_${runId}`, customer: `cus_1_${runId}` } }))).toBe("ok");
    expect(await handleAsaasEvent(evt("evt_3", "PAYMENT_RECEIVED", { payment: { id: "pay_1", customer: `cus_1_${runId}`, subscription: `sub_abc_${runId}`, dueDate: "2026-10-08" } }))).toBe("ok");

    const store = await createSupabaseStore(admin, userId, null);
    const s = await store.getSettings();
    expect(s.plan).toBe("monthly");
    expect(s.billing).toMatchObject({ renews: true, pastDue: false });
    expect(s.billing!.periodEnd!.slice(0, 10)).toBe("2026-11-08");

    await handleAsaasEvent(evt("evt_4", "PAYMENT_OVERDUE", { payment: { id: "pay_2", customer: `cus_1_${runId}`, subscription: `sub_abc_${runId}` } }));
    expect((await store.getSettings()).billing!.pastDue).toBe(true);
  });

  it("cancelar para de cobrar na Asaas e mantém o acesso até o fim do período", async () => {
    const { cancelSubscription } = await import("./asaas");
    const { createSupabaseStore } = await import("@/lib/data/supabase-store");
    expect(await cancelSubscription(userId)).toBe(true);
    expect(calls.at(-1)).toMatchObject({ method: "DELETE", url: `/v3/subscriptions/sub_abc_${runId}` });
    const s = await (await createSupabaseStore(admin, userId, null)).getSettings();
    expect(s.plan).toBe("monthly");
    expect(s.billing!.renews).toBe(false);
  });

  it("anual: pagamento único por Pix ou cartão libera 12 meses", async () => {
    const { createCheckout, handleAsaasEvent } = await import("./asaas");
    await admin.from("subscriptions").delete().eq("user_id", userId);
    const url = await createCheckout(userId, "yearly", null);
    expect(calls.at(-1)!.body).toMatchObject({ billingTypes: ["PIX", "CREDIT_CARD"], chargeTypes: ["DETACHED"], items: [{ value: 359 }] });
    await handleAsaasEvent(evt("evt_9", "CHECKOUT_PAID", { checkout: { id: url.split("id=")[1], customer: `cus_2_${runId}` } }));
    const { data } = await admin.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end").eq("user_id", userId).single();
    expect(data).toMatchObject({ plan: "yearly", status: "active", cancel_at_period_end: true });
    expect(new Date(data!.current_period_end!).getTime() - Date.now()).toBeGreaterThan(360 * 86_400_000);
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
