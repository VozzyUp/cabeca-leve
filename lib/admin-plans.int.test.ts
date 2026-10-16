import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSupabaseStore } from "@/lib/data/supabase-store";
import type { PlanInput } from "@/lib/plans";
import type { Database } from "@/lib/supabase/database.types";

// Planos do time contra o Supabase local.
// SUPABASE_TEST=1 npx vitest run lib/admin-plans.int.test.ts
const run = process.env.SUPABASE_TEST === "1";

describe.skipIf(!run)("planos do time", () => {
  const admin = createClient<Database>("http://127.0.0.1:54321", (process.env.SUPABASE_SECRET_KEY ?? ""), { auth: { persistSession: false } });
  const stamp = Date.now();
  const by = `time-${stamp}@teste.local`;
  const name = `Teste ${stamp}`;
  const userIds: string[] = [];
  const planIds: string[] = [];
  let mod: typeof import("./admin-plans");
  let accounts: typeof import("./admin-accounts");

  const input = (over: Partial<PlanInput> = {}): PlanInput => ({
    id: null, name, tagline: null, priceCents: 5990, months: 3, recurring: true, whatsappLimit: 5, messagesPerDay: 400, storageMb: 4096, featured: false, active: true, sort: 500, ...over,
  });
  const row = async (id: string) => (await admin.from("plans").select("*").eq("id", id).single()).data!;

  beforeAll(async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      SUPABASE_SECRET_KEY: (process.env.SUPABASE_SECRET_KEY ?? ""),
    });
    mod = await import("./admin-plans");
    accounts = await import("./admin-accounts");
  });
  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => {});
    for (const id of planIds) { await admin.from("checkout_sessions").delete().eq("plan", id); await admin.from("plans").delete().eq("id", id); }
    await admin.from("admin_actions").delete().eq("admin_email", by);
  });

  it("cria um plano: o id sai do nome e um nome repetido ganha número", async () => {
    const a = await mod.savePlan(by, input());
    expect(a).toMatchObject({ ok: true });
    const id = (a as { id: string }).id;
    planIds.push(id);
    expect(id).toMatch(/^teste-\d+$/);
    expect(await row(id)).toMatchObject({ kind: "paid", price_cents: 5990, months: 3, recurring: true, whatsapp_limit: 5, messages_per_day: 400, storage_mb: 4096 });
    const b = await mod.savePlan(by, input());
    planIds.push((b as { id: string }).id);
    expect((b as { id: string }).id).toBe(`${id}-2`);
  });

  it("edita valor e limites e guarda no registro o que mudou (sem conta alvo)", async () => {
    const id = planIds[0];
    expect(await mod.savePlan(by, input({ id, priceCents: 6990, messagesPerDay: 800 }))).toEqual({ ok: true, id });
    expect(await row(id)).toMatchObject({ price_cents: 6990, messages_per_day: 800 });
    const log = (await mod.listPlanActions(50)).find((a) => a.adminEmail === by && a.action === "plano editado");
    expect(log?.detail).toMatchObject({ id, changes: { priceCents: [5990, 6990], messagesPerDay: [400, 800] } });
    const { data } = await admin.from("admin_actions").select("target_user_id").eq("admin_email", by).eq("action", "plano editado");
    expect(data?.every((r) => r.target_user_id === null)).toBe(true);
  });

  it("recusa dados inválidos com mensagem", async () => {
    expect(await mod.savePlan(by, input({ name: "  " }))).toMatchObject({ ok: false, error: expect.stringMatching(/nome/i) });
    expect(await mod.savePlan(by, input({ priceCents: 0 }))).toMatchObject({ ok: false });
    expect(await mod.savePlan(by, input({ id: "nao-existe-aqui" }))).toMatchObject({ ok: false, error: expect.stringMatching(/não encontrado/) });
  });

  it("o teste grátis só muda de limites e não se exclui", async () => {
    expect(await mod.savePlan(by, input({ id: "trial" }))).toMatchObject({ ok: false, error: expect.stringMatching(/teste/i) });
    expect(await mod.deletePlan(by, "trial")).toMatchObject({ ok: false });
    const before = await row("trial");
    expect(await mod.saveTrial(by, { whatsappLimit: 3, messagesPerDay: 77, storageMb: 55 })).toEqual({ ok: true });
    expect(await row("trial")).toMatchObject({ whatsapp_limit: 3, messages_per_day: 77, storage_mb: 55 });
    await admin.from("plans").update({ whatsapp_limit: before.whatsapp_limit, messages_per_day: before.messages_per_day, storage_mb: before.storage_mb }).eq("id", "trial");
  });

  it("plano com assinatura: preço e limites mudam, duração e cobrança não; não exclui, desativa", async () => {
    const id = planIds[1];
    const { data } = await admin.auth.admin.createUser({ email: `plano-${stamp}@teste.local`, password: "x".repeat(12), email_confirm: true });
    userIds.push(data.user!.id);
    expect(await accounts.setManualPlan(by, data.user!.id, id, "2099-12-31")).toEqual({ ok: true });
    expect(await mod.savePlan(by, input({ id, months: 12 }))).toMatchObject({ ok: false, error: expect.stringMatching(/duração/) });
    expect(await mod.savePlan(by, input({ id, recurring: false }))).toMatchObject({ ok: false });
    expect(await mod.savePlan(by, input({ id, priceCents: 4990, whatsappLimit: 7 }))).toMatchObject({ ok: true });
    expect(await mod.deletePlan(by, id)).toMatchObject({ ok: false, error: expect.stringMatching(/Desative/) });
    expect(await mod.savePlan(by, input({ id, active: false, whatsappLimit: 7 }))).toMatchObject({ ok: true });
    const usage = (await mod.planUsage())[id];
    expect(usage).toMatchObject({ subscriptions: 1, active: 1 });
    // quem tem o plano segue com ele e vale o limite novo, mesmo fora de venda
    const s = await (await createSupabaseStore(admin, data.user!.id, null)).getSettings();
    expect(s.plan).toBe(id);
    expect(s.planInfo).toMatchObject({ id, whatsappLimit: 7, messagesPerDay: 400, storageMb: 4096, active: false });
    expect(s.whatsapp?.limit).toBe(7);
  });

  it("plano manual só aceita plano pago que existe", async () => {
    const uid = userIds[0];
    expect(await accounts.setManualPlan(by, uid, "nao-existe", "2099-12-31")).toMatchObject({ ok: false, error: expect.stringMatching(/não existe/) });
    expect(await accounts.setManualPlan(by, uid, "trial", "2099-12-31")).toMatchObject({ ok: false });
  });

  it("exclui plano que nunca teve assinatura", async () => {
    const id = planIds[2] ?? (await mod.savePlan(by, input({ name: `${name} extra` })) as { id: string }).id;
    if (!planIds.includes(id)) planIds.push(id);
    expect(await mod.deletePlan(by, id)).toEqual({ ok: true });
    expect((await admin.from("plans").select("id").eq("id", id)).data).toEqual([]);
    expect((await mod.listPlanActions(50)).some((a) => a.adminEmail === by && a.action === "plano excluído")).toBe(true);
  });
});
