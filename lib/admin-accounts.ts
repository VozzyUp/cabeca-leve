import { storeForUser } from "@/lib/data";
import { isValidPlanEnd, MANUAL_PREFIX, type AccountRow } from "@/lib/domain/accounts";
import { isSupportAdmin } from "@/lib/support";
import { getAdmin } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";

// Gestão de contas pelo time (só ADMIN_EMAILS, conferido nas ações): lista, plano manual, teste e exclusão.
// Tudo que muda uma conta fica no registro (admin_actions), inclusive a exclusão.

export type AdminResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): AdminResult => ({ ok: false, error });

export async function loadAccounts(): Promise<AccountRow[]> {
  const { data, error } = await getAdmin().rpc("admin_accounts");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    userId: r.user_id, email: r.email, name: r.name, createdAt: r.created_at, lastSignInAt: r.last_sign_in_at, trialEndsOn: r.trial_ends_on,
    subPlan: r.sub_plan, subStatus: r.sub_status, subEnd: r.sub_end, subRef: r.sub_ref, subCancels: r.sub_cancels,
    whatsapps: Number(r.whatsapps), documents: Number(r.documents), storageBytes: Number(r.storage_bytes), messages30d: Number(r.messages_30d), lastMessageAt: r.last_message_at,
  }));
}

export type AdminAction = { id: number; adminEmail: string; action: string; detail: Record<string, unknown>; createdAt: string };

export async function listAdminActions(userId: string, limit = 30): Promise<AdminAction[]> {
  const { data } = await getAdmin().from("admin_actions").select("id, admin_email, action, detail, created_at").eq("target_user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map((a) => ({ id: a.id, adminEmail: a.admin_email, action: a.action, detail: (a.detail ?? {}) as Record<string, unknown>, createdAt: a.created_at }));
}

async function log(by: string, userId: string, email: string | null, action: string, detail: Record<string, unknown>) {
  await getAdmin().from("admin_actions").insert({ admin_email: by, target_user_id: userId, target_email: email, action, detail: detail as never });
}

async function target(userId: string) {
  const { data } = await getAdmin().auth.admin.getUserById(userId);
  const { data: profile } = await getAdmin().from("profiles").select("timezone").eq("user_id", userId).maybeSingle();
  return data.user && profile ? { email: data.user.email ?? null, timezone: profile.timezone } : null;
}

const manualRows = () => getAdmin().from("subscriptions");

// Dá (ou renova, ou troca) o plano manual: qualquer plano do catálogo, ativo até o dia escolhido. Não cobra nada e a Asaas não conhece.
export async function setManualPlan(by: string, userId: string, plan: string, until: string): Promise<AdminResult> {
  const t = await target(userId);
  if (!t) return fail("Conta não encontrada.");
  const { data: chosen } = await getAdmin().from("plans").select("id").eq("id", plan).eq("kind", "paid").maybeSingle();
  if (!chosen) return fail("Esse plano não existe.");
  if (!isValidPlanEnd(until, localDate(new Date(), t.timezone))) return fail("Escolha uma data de hoje até 31/12/2099.");
  const db = getAdmin();
  const end = `${until}T23:59:59Z`;
  const { data: existing } = await manualRows().select("id, plan, current_period_end").eq("user_id", userId).like("provider_subscription_id", `${MANUAL_PREFIX}%`).order("created_at", { ascending: false }).limit(1);
  if (existing?.[0]) {
    const { error } = await db.from("subscriptions").update({ plan, status: "active", current_period_end: end, cancel_at_period_end: false, canceled_at: null, cancel_protocol: null, updated_at: new Date().toISOString() }).eq("id", existing[0].id);
    if (error) return fail(error.message);
  } else {
    const { error } = await db.from("subscriptions").insert({
      user_id: userId, provider: "asaas", provider_customer_id: "manual", provider_subscription_id: `${MANUAL_PREFIX}${userId}`, plan, status: "active",
      current_period_end: end, cancel_at_period_end: false, checkout_email: t.email,
    });
    if (error) return fail(error.message);
  }
  await log(by, userId, t.email, "plano manual", { plan, until, before: existing?.[0] ? { plan: existing[0].plan, until: existing[0].current_period_end?.slice(0, 10) } : null });
  return { ok: true };
}

// Encerra o plano manual agora; a conta volta a valer pelo teste (se ainda vale) ou fica sem plano
export async function endManualPlan(by: string, userId: string): Promise<AdminResult> {
  const t = await target(userId);
  if (!t) return fail("Conta não encontrada.");
  const now = new Date().toISOString();
  const { data, error } = await getAdmin().from("subscriptions").update({ status: "canceled", current_period_end: now, canceled_at: now, updated_at: now })
    .eq("user_id", userId).like("provider_subscription_id", `${MANUAL_PREFIX}%`).in("status", ["active", "trialing", "past_due"]).select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail("Esta conta não tem plano manual ativo. Assinatura paga se cancela pela Asaas.");
  await log(by, userId, t.email, "plano manual encerrado", {});
  return { ok: true };
}

// Muda o último dia do teste grátis (estender, ou encerrar escolhendo ontem)
export async function setTrialEnd(by: string, userId: string, day: string): Promise<AdminResult> {
  const t = await target(userId);
  if (!t) return fail("Conta não encontrada.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T12:00:00Z`)) || day > "2100-01-01") return fail("Escolha uma data válida.");
  const db = getAdmin();
  const { data: before } = await db.from("profiles").select("trial_ends_on").eq("user_id", userId).single();
  const { error } = await db.from("profiles").update({ trial_ends_on: day }).eq("user_id", userId);
  if (error) return fail(error.message);
  await log(by, userId, t.email, "teste", { before: before?.trial_ends_on, after: day });
  return { ok: true };
}

// Exclui a conta e tudo dela (inclusive os arquivos). Pede o e-mail digitado e não deixa excluir o próprio time.
export async function deleteAccountAsAdmin(by: string, userId: string, confirmEmail: string): Promise<AdminResult> {
  const t = await target(userId);
  if (!t || !t.email) return fail("Conta não encontrada.");
  if (confirmEmail.trim().toLowerCase() !== t.email.toLowerCase()) return fail("O e-mail digitado não confere.");
  if (isSupportAdmin(t.email)) return fail("Contas do time não se excluem por aqui.");
  await log(by, userId, t.email, "conta excluída", {});  // antes: depois dela não haveria quem registrar
  await (await storeForUser(userId)).deleteAllData();
  return { ok: true };
}
