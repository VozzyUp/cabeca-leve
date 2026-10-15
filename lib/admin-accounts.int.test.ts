import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSupabaseStore } from "@/lib/data/supabase-store";
import { accountState } from "@/lib/domain/accounts";
import type { Database } from "@/lib/supabase/database.types";
import { localDate } from "@/lib/time";

// Gestão de contas pelo time contra o Supabase local.
// SUPABASE_TEST=1 npx vitest run lib/admin-accounts.int.test.ts
const run = process.env.SUPABASE_TEST === "1";

describe.skipIf(!run)("contas do time", () => {
  const admin = createClient<Database>("http://127.0.0.1:54321", (process.env.SUPABASE_SECRET_KEY ?? ""), { auth: { persistSession: false } });
  const stamp = Date.now();
  const ids: string[] = [];
  const today = localDate(new Date(), "America/Sao_Paulo");
  let mod: typeof import("./admin-accounts");

  const make = async (tag: string) => {
    const { data } = await admin.auth.admin.createUser({ email: `${tag}-${stamp}@teste.local`, password: "x".repeat(12), email_confirm: true, user_metadata: { name: tag } });
    ids.push(data.user!.id);
    return data.user!.id;
  };
  const settings = async (id: string) => (await createSupabaseStore(admin, id, null)).getSettings();

  beforeAll(async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      SUPABASE_SECRET_KEY: (process.env.SUPABASE_SECRET_KEY ?? ""), ADMIN_EMAILS: `time-${stamp}@teste.local`,
    });
    mod = await import("./admin-accounts");
  });
  afterAll(async () => { for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {}); });

  it("lista as contas com situação, uso e plano que vale agora", async () => {
    const trial = await make("teste");
    const expired = await make("vencida");
    await admin.from("profiles").update({ trial_ends_on: "2020-01-01" }).eq("user_id", expired);
    const paid = await make("paga");
    await admin.from("subscriptions").insert({ user_id: paid, provider: "asaas", provider_customer_id: "c", provider_subscription_id: `sub_${stamp}`, plan: "yearly", status: "active", current_period_end: "2027-03-01T00:00:00Z" });
    await admin.from("channel_links").insert({ user_id: paid, channel: "whatsapp", external_id: `+55119${String(stamp).slice(-8)}`, verified_at: new Date().toISOString() });
    // uma assinatura cancelada e vencida não conta; só a que vale
    await admin.from("subscriptions").insert({ user_id: expired, provider: "asaas", provider_customer_id: "c", provider_subscription_id: `old_${stamp}`, plan: "monthly", status: "canceled", current_period_end: "2020-02-01T00:00:00Z" });

    const rows = await mod.loadAccounts();
    const by = (id: string) => rows.find((r) => r.userId === id)!;
    expect(accountState(by(trial), today)).toMatchObject({ kind: "trial" });
    expect(accountState(by(expired), today)).toMatchObject({ kind: "expired" });
    expect(accountState(by(paid), today)).toMatchObject({ kind: "paid", plan: "yearly", until: "2027-03-01", manual: false });
    expect(by(paid).whatsapps).toBe(1);
    expect(by(trial).email).toBe(`teste-${stamp}@teste.local`);
    expect(by(trial).name).toBe("teste");
  });

  it("plano manual: dá, troca e renova na mesma linha, e o app passa a ver o plano; encerrar volta ao teste", async () => {
    const id = await make("manual");
    const by = `time-${stamp}@teste.local`;
    expect((await settings(id)).plan).toBe("trial");

    expect(await mod.setManualPlan(by, id, "yearly", "2099-12-31")).toEqual({ ok: true });
    const s = await settings(id);
    expect(s.plan).toBe("yearly");
    expect(s.billing?.periodEnd?.slice(0, 10)).toBe("2099-12-31");
    expect(s.whatsapp?.limit).toBe(3);

    // trocar para mensal e renovar: continua uma linha só
    expect(await mod.setManualPlan(by, id, "monthly", "2027-01-31")).toEqual({ ok: true });
    expect((await admin.from("subscriptions").select("id, plan").eq("user_id", id)).data).toEqual([expect.objectContaining({ plan: "monthly" })]);
    expect((await settings(id)).plan).toBe("monthly");

    // data inválida: passado, depois de 2099, texto
    for (const bad of ["2020-01-01", "2100-06-01", "amanhã"]) expect(await mod.setManualPlan(by, id, "monthly", bad)).toMatchObject({ ok: false });
    expect((await settings(id)).plan).toBe("monthly");

    // encerrar: volta a valer o teste
    expect(await mod.endManualPlan(by, id)).toEqual({ ok: true });
    expect((await settings(id)).plan).toBe("trial");
    expect(await mod.endManualPlan(by, id)).toMatchObject({ ok: false, error: expect.stringContaining("plano manual") });

    // dar de novo reaproveita a linha que foi encerrada
    expect(await mod.setManualPlan(by, id, "yearly", "2099-12-31")).toEqual({ ok: true });
    expect((await admin.from("subscriptions").select("id").eq("user_id", id)).data).toHaveLength(1);
    expect((await settings(id)).plan).toBe("yearly");

    // tudo foi para o registro
    const log = await mod.listAdminActions(id);
    expect(log.map((a) => a.action)).toEqual(["plano manual", "plano manual encerrado", "plano manual", "plano manual"]);  // do mais novo ao mais antigo; as recusadas não entram
    expect(log[0]).toMatchObject({ adminEmail: by, action: "plano manual", detail: { plan: "yearly", until: "2099-12-31" } });
  });

  it("reconhece o plano manual dado à mão antes (outro identificador com o prefixo manual-) e não mexe em assinatura paga", async () => {
    const id = await make("antigo");
    await admin.from("subscriptions").insert({ user_id: id, provider: "asaas", provider_customer_id: "manual", provider_subscription_id: "manual-dono-2099", plan: "yearly", status: "active", current_period_end: "2099-12-31T23:59:59Z" });
    const row = (await mod.loadAccounts()).find((r) => r.userId === id)!;
    expect(accountState(row, today)).toMatchObject({ manual: true, kind: "paid", until: "2099-12-31" });
    expect(await mod.setManualPlan("x@y.z", id, "monthly", "2030-01-01")).toEqual({ ok: true });
    expect((await admin.from("subscriptions").select("provider_subscription_id, plan").eq("user_id", id)).data).toEqual([{ provider_subscription_id: "manual-dono-2099", plan: "monthly" }]);

    // quem paga pela Asaas não tem plano manual para encerrar
    const paying = await make("pagante");
    await admin.from("subscriptions").insert({ user_id: paying, provider: "asaas", provider_customer_id: "c", provider_subscription_id: `sub_p_${stamp}`, plan: "monthly", status: "active", current_period_end: "2027-01-01T00:00:00Z" });
    expect(await mod.endManualPlan("x@y.z", paying)).toMatchObject({ ok: false });
    expect((await admin.from("subscriptions").select("status").eq("user_id", paying).single()).data!.status).toBe("active");
  });

  it("teste: estende e encerra", async () => {
    const id = await make("teste2");
    expect(await mod.setTrialEnd("x@y.z", id, "2030-05-05")).toEqual({ ok: true });
    expect((await settings(id)).trialEndsOn).toBe("2030-05-05");
    expect(await mod.setTrialEnd("x@y.z", id, "2020-01-01")).toEqual({ ok: true });
    expect((await settings(id)).plan).toBe("none");
    expect(await mod.setTrialEnd("x@y.z", id, "banana")).toMatchObject({ ok: false });
    expect(await mod.setTrialEnd("x@y.z", "00000000-0000-4000-8000-000000000000", "2030-05-05")).toMatchObject({ ok: false, error: "Conta não encontrada." });
  });

  it("excluir: pede o e-mail certo, protege o time, apaga a conta e os arquivos e deixa o registro", async () => {
    const id = await make("excluir");
    const store = await createSupabaseStore(admin, id, null);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
    await store.addDocument({ folderId: null, title: "Nota", issuer: null, beneficiary: null, category: null, docDate: null, amountCents: null, status: null, dueOn: null, notes: null, fileName: "n.png", mimeType: "image/png", source: "web" }, png);
    expect((await admin.storage.from("documents").list(id)).data).toHaveLength(1);

    expect(await mod.deleteAccountAsAdmin("time@x.y", id, "outro@email.com")).toEqual({ ok: false, error: "O e-mail digitado não confere." });
    expect((await admin.auth.admin.getUserById(id)).data.user).toBeTruthy();

    // conta do time não se exclui por aqui
    const team = await admin.auth.admin.createUser({ email: `time-${stamp}@teste.local`, password: "x".repeat(12), email_confirm: true });
    ids.push(team.data.user!.id);
    expect(await mod.deleteAccountAsAdmin("time@x.y", team.data.user!.id, `time-${stamp}@teste.local`)).toMatchObject({ ok: false, error: expect.stringContaining("time") });

    expect(await mod.deleteAccountAsAdmin("time@x.y", id, `EXCLUIR-${stamp}@teste.local`.replace("EXCLUIR", "excluir").toUpperCase())).toEqual({ ok: true });
    expect((await admin.auth.admin.getUserById(id)).data.user).toBeNull();
    expect((await admin.storage.from("documents").list(id)).data).toHaveLength(0);
    // o registro fica, com o e-mail
    const { data } = await admin.from("admin_actions").select("action, target_email, admin_email").eq("target_user_id", id);
    expect(data).toEqual([{ action: "conta excluída", target_email: `excluir-${stamp}@teste.local`, admin_email: "time@x.y" }]);
    // e o navegador não lê nem a função nem o registro
    const anon = createClient<Database>("http://127.0.0.1:54321", "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH", { auth: { persistSession: false } });
    expect((await anon.rpc("admin_accounts")).error).not.toBeNull();
    expect((await anon.from("admin_actions").select("id")).data ?? []).toEqual([]);
  });
});
