// Modelos e níveis de esforço que o assistente aceita (escolhidos em /admin/configuracoes).
// Arquivo sem dependências de servidor: a tela de admin e o agente leem a mesma lista.

export const MODEL_OPTIONS = [
  { id: "claude-haiku-5-5", label: "Haiku 5.5: o mais barato e rápido", price: "US$ 0,10 / US$ 0,50 por milhão de tokens (entrada / saída)" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5: equilíbrio (recomendado)", price: "US$ 2 / US$ 10 por milhão de tokens" },
  { id: "claude-opus-5-5", label: "Opus 5.5: o mais capaz e o mais caro", price: "US$ 4 / US$ 20 por milhão de tokens" },
] as const;
export type ModelId = (typeof MODEL_OPTIONS)[number]["id"];
export const DEFAULT_MODEL: ModelId = "claude-sonnet-5-5";

export const EFFORT_OPTIONS = [
  { id: "low", label: "Baixo: respostas rápidas e baratas" },
  { id: "medium", label: "Médio: equilibrado (recomendado)" },
  { id: "high", label: "Alto: pensa mais antes de responder" },
  { id: "xhigh", label: "Muito alto: para pedidos difíceis" },
  { id: "max", label: "Máximo: o que mais pensa e mais gasta" },
] as const;
export type EffortId = (typeof EFFORT_OPTIONS)[number]["id"];
export const DEFAULT_EFFORT: EffortId = "medium";

const isModel = (v: string | undefined): v is ModelId => MODEL_OPTIONS.some((m) => m.id === v);
const isEffort = (v: string | undefined): v is EffortId => EFFORT_OPTIONS.some((e) => e.id === v);

// Valor inválido ou vazio cai no padrão: um erro de digitação nunca derruba a conversa
export const resolveModel = (value = process.env.ANTHROPIC_MODEL): ModelId => (isModel(value?.trim()) ? (value!.trim() as ModelId) : DEFAULT_MODEL);
export const resolveEffort = (value = process.env.ANTHROPIC_EFFORT): EffortId => (isEffort(value?.trim()) ? (value!.trim() as EffortId) : DEFAULT_EFFORT);

// O recurso de reserva automática (fallback) não existe no Haiku 5.5
export const supportsFallback = (model: ModelId) => model !== "claude-haiku-5-5";

// Preços da Anthropic em US$ por milhão de tokens (tabela de preços de outubro de 2026). Escrita de cache de 5 minutos
// custa 1,25x a entrada; a leitura de cache do Haiku é estimada em 0,1x (a tabela pública não a lista).
// Modelo fora desta lista (por exemplo, um de reserva) aparece na tela de custos sem preço, só com os tokens.
export type Price = { input: number; output: number; cacheWrite: number; cacheRead: number };
export const PRICES: Record<string, Price> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
};
export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number };

export function costUsd(model: string, t: Tokens): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return (t.input * p.input + t.output * p.output + t.cacheRead * p.cacheRead + t.cacheWrite * p.cacheWrite) / 1_000_000;
}

export const modelLabel = (id: string) => MODEL_OPTIONS.find((m) => m.id === id)?.label.split(":")[0] ?? id;
