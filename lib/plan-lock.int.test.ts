import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

// Bloqueio de quem está sem plano, contra o Supabase local.
// SUPABASE_TEST=1 npx vitest run lib/plan-lock.int.test.ts
const run = process.env.SUPABASE_TEST === "1";

describe.skipIf(!run)("bloqueio sem plano", () => {
  const admin = createClient<Database>("http://127.0.0.1:54321", (process.env.SUPABASE_SECRET_KEY ?? ""), { auth: { persistSession: false } });
  const stamp = Date.now();
  let userId = "";
  let lock: typeof import("./plan-lock");

  const setTrial = (day: string) => admin.from("profiles").update({ trial_ends_on: day }).eq("user_id", userId);
  const locked = async (email = "pessoa@teste.local") => { lock.forgetLock(userId); return lock.isLocked(admin, userId, email); };

  beforeAll(async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      SUPABASE_SECRET_KEY: (process.env.SUPABASE_SECRET_KEY ?? ""), ADMIN_EMAILS: `time-${stamp}@teste.local`,
    });
    lock = await import("./plan-lock");
    const { data } = await admin.auth.admin.createUser({ email: `lock-${stamp}@teste.local`, password: "x".repeat(12), email_confirm: true });
    userId = data.user!.id;
  });
  afterAll(async () => { await admin.auth.admin.deleteUser(userId).catch(() => {}); });

  it("teste dentro do prazo libera; vencido e sem assinatura bloqueia", async () => {
    expect(await locked()).toBe(false);
    await setTrial("2026-01-01");
    expect(await locked()).toBe(true);
  });

  it("assinatura que vale libera; vencida bloqueia; cancelada dentro do período ainda libera", async () => {
    await setTrial("2026-01-01");
    const row = { user_id: userId, provider: "asaas", provider_customer_id: "c", plan: "monthly" };
    await admin.from("subscriptions").insert({ ...row, provider_subscription_id: `a-${stamp}`, status: "canceled", current_period_end: "2026-02-01T00:00:00Z" });
    expect(await locked()).toBe(true);
    await admin.from("subscriptions").update({ current_period_end: "2099-01-01T00:00:00Z" }).eq("provider_subscription_id", `a-${stamp}`);
    expect(await locked()).toBe(false);
    await admin.from("subscriptions").update({ status: "active", current_period_end: "2026-02-01T00:00:00Z" }).eq("provider_subscription_id", `a-${stamp}`);
    expect(await locked()).toBe(false);  // ativa vale mesmo com a data atrasada (a Asaas ainda vai avisar)
    await admin.from("subscriptions").delete().eq("user_id", userId);
    expect(await locked()).toBe(true);
  });

  it("voltou do pagamento nas últimas 2 horas: libera enquanto a Asaas confirma", async () => {
    await setTrial("2026-01-01");
    const id = `chk_lock_${stamp}`;
    await admin.from("checkout_sessions").insert({ id, user_id: userId, plan: "monthly", status: "pending" });
    expect(await locked()).toBe(true);  // abriu o pagamento, mas não voltou
    await admin.from("checkout_sessions").update({ returned_at: new Date().toISOString() }).eq("id", id);
    expect(await locked()).toBe(false);
    await admin.from("checkout_sessions").update({ returned_at: new Date(Date.now() - 3 * 3_600_000).toISOString() }).eq("id", id);
    expect(await locked()).toBe(true);
    await admin.from("checkout_sessions").delete().eq("id", id);
  });

  it("o time nunca é bloqueado, e só o liberado fica guardado (quem acabou de pagar entra na hora)", async () => {
    await setTrial("2026-01-01");
    lock.forgetLock(userId);
    expect(await lock.isLocked(admin, userId, `time-${stamp}@teste.local`)).toBe(false);
    expect(await locked()).toBe(true);
    await admin.from("subscriptions").insert({ user_id: userId, provider: "asaas", provider_customer_id: "c", plan: "monthly", provider_subscription_id: `b-${stamp}`, status: "active", current_period_end: "2099-01-01T00:00:00Z" });
    expect(await lock.isLocked(admin, userId, "pessoa@teste.local")).toBe(false);  // sem forgetLock: o bloqueio não ficou guardado
    await admin.from("subscriptions").delete().eq("user_id", userId);
  });

  it("quais caminhos seguem abertos", () => {
    for (const open of ["/ajustes", "/ajustes/", "/ajustes/plano", "/ajustes/suporte", "/api/billing/status"]) expect(lock.openWhenLocked(open), open).toBe(true);
    for (const closed of ["/conversa", "/tarefas", "/ajustes/assistente", "/avisos", "/mais", "/documentos", "/api/tasks", "/api/chat", "/ajustes/plano/x"]) expect(lock.openWhenLocked(closed), closed).toBe(false);
  });
});
