import { addDays } from "@/lib/time";

// Regras da tela de contas do time: em que situação cada conta está, o resumo e os filtros.
// A situação segue a mesma regra do app (getSettings): assinatura que vale agora, senão o teste, senão sem plano.

export type AccountRow = {
  userId: string; email: string | null; name: string | null; createdAt: string; lastSignInAt: string | null; trialEndsOn: string;
  subPlan: string | null; subStatus: string | null; subEnd: string | null; subRef: string | null; subCancels: boolean | null;
  whatsapps: number; documents: number; storageBytes: number; messages30d: number; lastMessageAt: string | null;
};

export type AccountKind = "paid" | "canceling" | "past_due" | "trial" | "expired";
export type AccountState = { kind: AccountKind; label: string; plan: string | null; until: string | null; manual: boolean; daysLeft: number | null };

export const KIND_LABEL: Record<AccountKind, string> = { paid: "Plano ativo", canceling: "Cancelado (vale até o fim)", past_due: "Pagamento atrasado", trial: "Em teste", expired: "Sem plano" };
// Nome de cada plano pelo id; a tela passa os do catálogo (o time pode criar e renomear). Estes valem sem ele.
export const DEFAULT_PLAN_NAMES: Record<string, string> = { monthly: "Mensal", yearly: "Anual" };
export const MANUAL_PREFIX = "manual-";
export const MAX_PLAN_DAY = "2100-01-01";

const dayNumber = (day: string) => Math.round(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

export function accountState(row: AccountRow, today: string, names: Record<string, string> = DEFAULT_PLAN_NAMES): AccountState {
  if (row.subStatus && row.subPlan) {
    const plan = row.subPlan;
    const until = row.subEnd ? row.subEnd.slice(0, 10) : null;
    const kind: AccountKind = row.subStatus === "past_due" ? "past_due" : row.subCancels || row.subStatus === "canceled" ? "canceling" : "paid";
    return { kind, label: names[plan] ?? plan, plan, until, manual: !!row.subRef?.startsWith(MANUAL_PREFIX), daysLeft: until ? daysBetween(today, until) : null };
  }
  const trial = row.trialEndsOn >= today;
  return { kind: trial ? "trial" : "expired", label: trial ? "Teste" : "Sem plano", plan: null, until: row.trialEndsOn, manual: false, daysLeft: daysBetween(today, row.trialEndsOn) };
}

// "Atenção": o que o time quer olhar primeiro (vai acabar, atrasou ou acabou há pouco)
export function needsAttention(row: AccountRow, today: string): boolean {
  const s = accountState(row, today);
  if (s.kind === "past_due") return true;
  if (s.kind === "trial") return s.daysLeft !== null && s.daysLeft <= 2;
  if (s.kind === "canceling") return true;
  if (s.kind === "expired") return s.daysLeft !== null && s.daysLeft >= -7;  // acabou na última semana: ainda dá para recuperar
  return !s.manual && s.daysLeft !== null && s.daysLeft <= 7;  // renovação paga chegando
}

export type AccountFilter = "all" | "paid" | "trial" | "expired" | "attention" | "manual";

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

export function filterAccounts(rows: AccountRow[], filter: AccountFilter, query: string, today: string): AccountRow[] {
  const q = plain(query.trim());
  return rows.filter((r) => {
    const s = accountState(r, today);
    if (filter === "paid" && !(s.kind === "paid" || s.kind === "canceling" || s.kind === "past_due")) return false;
    if (filter === "trial" && s.kind !== "trial") return false;
    if (filter === "expired" && s.kind !== "expired") return false;
    if (filter === "manual" && !s.manual) return false;
    if (filter === "attention" && !needsAttention(r, today)) return false;
    return !q || plain(`${r.email ?? ""} ${r.name ?? ""}`).includes(q);
  });
}

export type AccountsSummary = { total: number; paid: number; trial: number; expired: number; manual: number; attention: number; newThisWeek: number; active30d: number };

export function summarizeAccounts(rows: AccountRow[], today: string): AccountsSummary {
  const out: AccountsSummary = { total: rows.length, paid: 0, trial: 0, expired: 0, manual: 0, attention: 0, newThisWeek: 0, active30d: 0 };
  const weekAgo = addDays(today, -7);
  for (const r of rows) {
    const s = accountState(r, today);
    if (s.kind === "trial") out.trial++;
    else if (s.kind === "expired") out.expired++;
    else out.paid++;
    if (s.manual) out.manual++;
    if (needsAttention(r, today)) out.attention++;
    if (r.createdAt.slice(0, 10) >= weekAgo) out.newThisWeek++;
    if (r.messages30d > 0) out.active30d++;
  }
  return out;
}

// Renovar: soma os dias a partir do fim atual (se ainda vale) ou de hoje (se já acabou)
export function renewFrom(currentEnd: string | null, today: string, days: number): string {
  const base = currentEnd && currentEnd > today ? currentEnd : today;
  const next = addDays(base, days);
  return next > MAX_PLAN_DAY ? MAX_PLAN_DAY : next;
}

export const isValidPlanEnd = (day: string, today: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T12:00:00Z`)) && day >= today && day <= MAX_PLAN_DAY;

// 2026-10-15T… -> 15/10/2026
export const brDay = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

// Texto curto do prazo da conta: "vence em 12 dias", "venceu há 3 dias"
export function untilText(daysLeft: number | null) {
  if (daysLeft === null) return "";
  if (daysLeft > 365 * 5) return "";
  if (daysLeft < 0) return daysLeft === -1 ? "venceu ontem" : `venceu há ${-daysLeft} dias`;
  return daysLeft === 0 ? "vence hoje" : daysLeft === 1 ? "vence amanhã" : `vence em ${daysLeft} dias`;
}

