import { costUsd, modelLabel, type Tokens } from "@/lib/assistant/models";

// Custo da IA por usuário e por modelo (tela /admin/custos). Os tokens vêm da tabela ai_usage
// (somados por mensagem); o preço é calculado aqui com a tabela de preços do app.

export type UsageRow = { user_id: string; model: string; turns: number; calls: number; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number };
export type UserInfo = { name: string | null; email: string | null };

export type ModelTotal = { model: string; label: string; messages: number; calls: number; tokens: Tokens; costUsd: number | null };
export type UserTotal = { userId: string; name: string; email: string | null; messages: number; calls: number; tokens: Tokens; costUsd: number; hasUnpriced: boolean; models: ModelTotal[] };
export type CostSummary = { messages: number; calls: number; tokens: Tokens; costUsd: number; hasUnpriced: boolean; byModel: ModelTotal[]; byUser: UserTotal[] };

const zero = (): Tokens => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
const add = (a: Tokens, b: Tokens): Tokens => ({ input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite });
const tokensOf = (r: UsageRow): Tokens => ({ input: Number(r.input_tokens), output: Number(r.output_tokens), cacheRead: Number(r.cache_read_tokens), cacheWrite: Number(r.cache_write_tokens) });

export function summarize(rows: UsageRow[], users: Map<string, UserInfo>): CostSummary {
  const byModel = new Map<string, ModelTotal>();
  const byUser = new Map<string, UserTotal>();
  for (const r of rows) {
    const tokens = tokensOf(r), messages = Number(r.turns), calls = Number(r.calls), cost = costUsd(r.model, tokens);
    const m = byModel.get(r.model) ?? { model: r.model, label: modelLabel(r.model), messages: 0, calls: 0, tokens: zero(), costUsd: costUsd(r.model, zero()) };
    m.messages += messages; m.calls += calls; m.tokens = add(m.tokens, tokens);
    m.costUsd = m.costUsd === null ? null : m.costUsd + (cost ?? 0);
    byModel.set(r.model, m);

    const info = users.get(r.user_id);
    const u = byUser.get(r.user_id) ?? { userId: r.user_id, name: info?.name?.trim() || info?.email || "Conta apagada", email: info?.email ?? null, messages: 0, calls: 0, tokens: zero(), costUsd: 0, hasUnpriced: false, models: [] };
    u.messages += messages; u.calls += calls; u.tokens = add(u.tokens, tokens);
    u.costUsd += cost ?? 0; u.hasUnpriced ||= cost === null;
    u.models.push({ model: r.model, label: modelLabel(r.model), messages, calls, tokens, costUsd: cost });
    byUser.set(r.user_id, u);
  }
  const users_ = [...byUser.values()].map((u) => ({ ...u, models: u.models.sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0)) })).sort((a, b) => b.costUsd - a.costUsd);
  const models = [...byModel.values()].sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0));
  // "mensagens" do total conta cada mensagem uma vez, mesmo que dois modelos tenham respondido (reserva automática)
  const messages = users_.reduce((n, u) => n + Math.max(...u.models.map((x) => x.messages), 0), 0);
  return {
    messages, calls: models.reduce((n, m) => n + m.calls, 0), tokens: models.reduce((t, m) => add(t, m.tokens), zero()),
    costUsd: models.reduce((n, m) => n + (m.costUsd ?? 0), 0), hasUnpriced: models.some((m) => m.costUsd === null), byModel: models, byUser: users_,
  };
}

// Períodos da tela: "hoje" e "mês" seguem o dia do fuso de São Paulo; "7d" e "30d" são janelas móveis
export const PERIODS = [
  { id: "hoje", label: "Hoje" }, { id: "7d", label: "7 dias" }, { id: "30d", label: "30 dias" }, { id: "mes", label: "Este mês" },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];
export const isPeriod = (v: string | undefined): v is PeriodId => PERIODS.some((p) => p.id === v);

export function periodRange(period: PeriodId, now: Date, tz = "America/Sao_Paulo"): { from: Date; to: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-").map(Number);
  const [y, m, d] = parts;
  // meia-noite local: usa o deslocamento do fuso naquele instante
  const midnight = (yy: number, mm: number, dd: number) => {
    const guess = new Date(Date.UTC(yy, mm - 1, dd, 12));
    const local = new Date(guess.toLocaleString("en-US", { timeZone: tz }));
    const offset = guess.getTime() - local.getTime();
    return new Date(Date.UTC(yy, mm - 1, dd) + offset);
  };
  const to = new Date(now.getTime() + 1000);
  if (period === "hoje") return { from: midnight(y, m, d), to };
  if (period === "mes") return { from: midnight(y, m, 1), to };
  return { from: new Date(now.getTime() - (period === "7d" ? 7 : 30) * 86_400_000), to };
}

export const parseRate = (value: string | undefined) => {
  const n = Number((value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 5.5;
};
