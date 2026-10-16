import { planFromRow, slugify, trialInput, planInput, type Plan, type PlanInput, type TrialInput } from "@/lib/plans";
import type { AdminResult } from "@/lib/admin-accounts";
import { getAdmin } from "@/lib/supabase/server";

// Planos geridos pelo time (só ADMIN_EMAILS, conferido nas ações): editar valor e limites, criar, desativar e excluir.
// Tudo fica no registro do time (admin_actions, sem conta alvo).

const fail = (error: string): AdminResult => ({ ok: false, error });
const FIELDS = ["name", "tagline", "priceCents", "months", "recurring", "whatsappLimit", "messagesPerDay", "storageMb", "featured", "active", "sort"] as const;

async function log(by: string, action: string, detail: Record<string, unknown>) {
  await getAdmin().from("admin_actions").insert({ admin_email: by, target_user_id: null, action, detail: detail as never });
}

export type PlanUsage = { subscriptions: number; active: number; checkouts: number };

// Quantas assinaturas e pagamentos em andamento usam cada plano
export async function planUsage(): Promise<Record<string, PlanUsage>> {
  const db = getAdmin();
  const [subs, checkouts] = await Promise.all([db.from("subscriptions").select("plan, status, current_period_end"), db.from("checkout_sessions").select("plan")]);
  const out: Record<string, PlanUsage> = {};
  const at = (id: string) => (out[id] ??= { subscriptions: 0, active: 0, checkouts: 0 });
  const now = new Date().toISOString();
  for (const s of subs.data ?? []) {
    at(s.plan).subscriptions++;
    if (["active", "trialing", "past_due"].includes(s.status) || (s.current_period_end ?? "") > now) at(s.plan).active++;
  }
  for (const c of checkouts.data ?? []) at(c.plan).checkouts++;
  return out;
}

export async function listPlanActions(limit = 20) {
  const { data } = await getAdmin().from("admin_actions").select("id, admin_email, action, detail, created_at").is("target_user_id", null).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map((a) => ({ id: a.id, adminEmail: a.admin_email, action: a.action, detail: (a.detail ?? {}) as Record<string, unknown>, createdAt: a.created_at }));
}

const toRow = (p: PlanInput) => ({
  name: p.name, tagline: p.tagline || null, price_cents: p.priceCents, months: p.months, recurring: p.recurring,
  whatsapp_limit: p.whatsappLimit, messages_per_day: p.messagesPerDay, storage_mb: p.storageMb, featured: p.featured, active: p.active, sort: p.sort,
});

const diff = (before: Plan, after: PlanInput) => Object.fromEntries(FIELDS.flatMap((f) => (before[f] !== (after[f] ?? null) && !(before[f] === null && after[f] === null) ? [[f, [before[f], after[f] ?? null]]] : [])));

async function otherActivePaid(exceptId: string) {
  const { data } = await getAdmin().from("plans").select("id").eq("kind", "paid").eq("active", true).neq("id", exceptId).limit(1);
  return !!data?.length;
}

// Cria (id nulo) ou edita um plano pago. Quem já tem assinatura ou pagamento em andamento mantém duração e forma de cobrança.
export async function savePlan(by: string, raw: PlanInput): Promise<AdminResult & { id?: string }> {
  const parsed = planInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Confira os campos.");
  const input = parsed.data;
  const db = getAdmin();
  if (input.id === null) {
    const base = slugify(input.name) || "plano";
    const { data: taken } = await db.from("plans").select("id").like("id", `${base}%`);
    const ids = new Set((taken ?? []).map((r) => r.id));
    let id = base.length >= 2 ? base : `${base}x`;
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`.slice(0, 32);
    const { error } = await db.from("plans").insert({ id, ...toRow(input) });
    if (error) return fail(error.message);
    await log(by, "plano criado", { id, name: input.name, priceCents: input.priceCents, months: input.months, recurring: input.recurring });
    return { ok: true, id };
  }
  const { data: row } = await db.from("plans").select("*").eq("id", input.id).maybeSingle();
  if (!row) return fail("Plano não encontrado.");
  if (row.kind === "trial") return fail("O teste grátis só muda de limites.");
  const before = planFromRow(row);
  const used = (await planUsage())[input.id];
  if (used && (used.subscriptions || used.checkouts) && (before.months !== input.months || before.recurring !== input.recurring)) {
    return fail("Este plano já tem assinaturas. A duração e a forma de cobrança não mudam: crie um plano novo e desative este.");
  }
  if (!input.active && before.active && !(await otherActivePaid(input.id))) return fail("Precisa sobrar pelo menos um plano à venda.");
  const { error } = await db.from("plans").update({ ...toRow(input), updated_at: new Date().toISOString() }).eq("id", input.id);
  if (error) return fail(error.message);
  const changes = diff(before, input);
  if (Object.keys(changes).length) await log(by, "plano editado", { id: input.id, name: before.name, changes });
  return { ok: true, id: input.id };
}

// Limites do teste grátis (mensagens por dia, WhatsApps, espaço)
export async function saveTrial(by: string, raw: TrialInput): Promise<AdminResult> {
  const parsed = trialInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Confira os campos.");
  const db = getAdmin();
  const { data: row } = await db.from("plans").select("*").eq("kind", "trial").maybeSingle();
  if (!row) return fail("Teste grátis não encontrado.");
  const before = planFromRow(row);
  const { error } = await db.from("plans").update({
    whatsapp_limit: parsed.data.whatsappLimit, messages_per_day: parsed.data.messagesPerDay, storage_mb: parsed.data.storageMb, updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (error) return fail(error.message);
  const changes = Object.fromEntries((["whatsappLimit", "messagesPerDay", "storageMb"] as const).flatMap((f) => (before[f] !== parsed.data[f] ? [[f, [before[f], parsed.data[f]]]] : [])));
  if (Object.keys(changes).length) await log(by, "teste grátis editado", { id: row.id, changes });
  return { ok: true };
}

// Só exclui plano sem nenhuma assinatura nem pagamento no histórico; os outros se desativam (somem da venda, quem tem continua)
export async function deletePlan(by: string, id: string): Promise<AdminResult> {
  const db = getAdmin();
  const { data: row } = await db.from("plans").select("*").eq("id", id).maybeSingle();
  if (!row) return fail("Plano não encontrado.");
  if (row.kind === "trial") return fail("O teste grátis não se exclui.");
  const used = (await planUsage())[id];
  if (used && (used.subscriptions || used.checkouts)) return fail("Este plano já teve assinaturas. Desative-o em vez de excluir: ele sai da venda e quem já tem continua.");
  if (row.active && !(await otherActivePaid(id))) return fail("Precisa sobrar pelo menos um plano à venda.");
  const { error } = await db.from("plans").delete().eq("id", id);
  if (error) return fail(error.message);
  await log(by, "plano excluído", { id, name: row.name });
  return { ok: true };
}
