import { describe, expect, it } from "vitest";
import { isPeriod, parseRate, periodRange, summarize, type UsageRow } from "./ai-costs";
import { costUsd } from "./assistant/models";

const row = (user_id: string, model: string, turns: number, t: Partial<UsageRow> = {}): UsageRow => ({
  user_id, model, turns, calls: turns * 2, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, ...t,
});

describe("custo da IA", () => {
  it("calcula o custo pelos quatro tipos de token", () => {
    // Sonnet 5.5: 1M de entrada (US$ 2) + 100 mil de saída (US$ 1) + 2M lidos do cache (US$ 0,40) + 400 mil gravados (US$ 1)
    expect(costUsd("claude-sonnet-5-5", { input: 1_000_000, output: 100_000, cacheRead: 2_000_000, cacheWrite: 400_000 })).toBeCloseTo(4.4, 6);
    expect(costUsd("claude-opus-5-5", { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(4, 6);
    expect(costUsd("claude-haiku-5-5", { input: 0, output: 1_000_000, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(0.5, 6);
    expect(costUsd("modelo-desconhecido", { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 })).toBeNull();
  });

  it("soma por usuário e por modelo, ordena pelo maior custo e mostra o detalhe por modelo", () => {
    const users = new Map([["a", { name: "Ana", email: "ana@x.com" }], ["b", { name: null, email: "bia@x.com" }]]);
    const s = summarize([
      row("a", "claude-sonnet-5-5", 10, { input_tokens: 1_000_000, output_tokens: 100_000 }),     // US$ 3,00
      row("a", "claude-haiku-5-5", 4, { input_tokens: 1_000_000 }),                              // US$ 0,10
      row("b", "claude-opus-5-5", 2, { input_tokens: 500_000, output_tokens: 100_000 }),         // US$ 4,00
      row("c", "claude-sonnet-5-5", 1, { input_tokens: 1_000_000 }),                              // conta apagada, US$ 2,00
    ], users);
    expect(s.byUser.map((u) => u.name)).toEqual(["bia@x.com", "Ana", "Conta apagada"]);  // sem nome, usa o e-mail
    const ana = s.byUser.find((u) => u.userId === "a")!;
    expect(ana.costUsd).toBeCloseTo(3.1, 6);
    expect(ana.messages).toBe(14);
    expect(ana.models.map((m) => m.label)).toEqual(["Sonnet 5.5", "Haiku 5.5"]);
    expect(s.byModel.map((m) => [m.label, m.messages])).toEqual([["Sonnet 5.5", 11], ["Opus 5.5", 2], ["Haiku 5.5", 4]]);
    expect(s.costUsd).toBeCloseTo(9.1, 6);
    expect(s.hasUnpriced).toBe(false);
  });

  it("modelo sem preço entra com os tokens e fica marcado, sem derrubar o total", () => {
    const s = summarize([row("a", "claude-opus-4-8", 3, { input_tokens: 1000 }), row("a", "claude-sonnet-5-5", 1, { input_tokens: 1_000_000 })], new Map([["a", { name: "Ana", email: null }]]));
    expect(s.hasUnpriced).toBe(true);
    expect(s.costUsd).toBeCloseTo(2, 6);
    expect(s.byModel.find((m) => m.model === "claude-opus-4-8")!.costUsd).toBeNull();
    expect(s.byUser[0].hasUnpriced).toBe(true);
  });

  it("uma mensagem respondida por dois modelos (reserva automática) conta uma vez no total do usuário", () => {
    const s = summarize([row("a", "claude-opus-5-5", 5), row("a", "claude-sonnet-5-5", 1)], new Map([["a", { name: "Ana", email: null }]]));
    expect(s.messages).toBe(5);
  });

  it("períodos: hoje e este mês começam à meia-noite de São Paulo; 7 e 30 dias são janelas móveis", () => {
    const now = new Date("2026-10-09T02:00:00Z");  // 23h de 8/10 em São Paulo
    expect(periodRange("hoje", now).from.toISOString()).toBe("2026-10-08T03:00:00.000Z");
    expect(periodRange("mes", now).from.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(periodRange("7d", now).from.toISOString()).toBe("2026-10-02T02:00:00.000Z");
    expect(periodRange("30d", now).from.toISOString()).toBe("2026-09-09T02:00:00.000Z");
    expect(periodRange("hoje", now).to.getTime()).toBeGreaterThan(now.getTime());
    expect(isPeriod("30d")).toBe(true);
    expect(isPeriod("ano")).toBe(false);
  });

  it("cotação: aceita vírgula e ponto; valor inválido cai em 5,50", () => {
    expect(parseRate("5,75")).toBe(5.75);
    expect(parseRate("6.1")).toBe(6.1);
    expect(parseRate("abc")).toBe(5.5);
    expect(parseRate("-1")).toBe(5.5);
    expect(parseRate(undefined)).toBe(5.5);
  });
});
