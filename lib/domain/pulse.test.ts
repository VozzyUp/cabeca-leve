import { describe, expect, it } from "vitest";
import type { Category, Recurrence, Transaction } from "@/lib/data/types";
import { spendingPulse } from "./pulse";

const cats: Category[] = [
  { id: "food", name: "Alimentação", kind: "expense" },
  { id: "ifood", name: "iFood", kind: "expense", parentId: "food" },
  { id: "subs", name: "Assinaturas", kind: "expense" },
  { id: "sal", name: "Salário", kind: "income" },
];
let n = 0;
const tx = (categoryId: string, occurredOn: string, reais: number, type: Transaction["type"] = "expense"): Transaction => ({
  id: `t${++n}`, type, amountCents: reais * 100, occurredOn, description: "x", categoryId, accountId: "a", paymentMethod: null, source: "chat", createdAt: "",
});
const sub = (description: string, reais: number): Recurrence => ({ id: description, kind: "subscription", description, amountCents: reais * 100, dayOfMonth: 5, categoryId: "subs", paymentMethod: null, active: true });

describe("termômetro do gasto", () => {
  it("compara com o mesmo período do mês passado, somando as subcategorias", () => {
    const p = spendingPulse({ categoryId: "ifood", today: "2026-10-10", recurrences: [], categories: cats, transactions: [
      tx("food", "2026-09-05", 200), tx("food", "2026-09-25", 999),   // depois do dia 10: fora da comparação
      tx("food", "2026-10-02", 150), tx("ifood", "2026-10-09", 160),
    ] })!;
    expect(p.category).toBe("Alimentação");
    expect(p.monthCents).toBe(31000);
    expect(p.previousSamePeriodCents).toBe(20000);
    expect(p.signals[0]).toMatch(/Alimentação: R\$\s*310,00 no mês, 55% acima/);
  });
  it("muitos lançamentos na semana viram sinal; poucos, não", () => {
    const week = ["2026-10-04", "2026-10-06", "2026-10-07", "2026-10-09", "2026-10-10"].map((d) => tx("ifood", d, 40));
    expect(spendingPulse({ categoryId: "ifood", today: "2026-10-10", recurrences: [], categories: cats, transactions: week })!.signals)
      .toEqual([expect.stringMatching(/^5º lançamento em Alimentação nos últimos 7 dias/)]);
    expect(spendingPulse({ categoryId: "ifood", today: "2026-10-10", recurrences: [], categories: cats, transactions: week.slice(0, 4) })!.signals).toEqual([]);
  });
  it("sem base no mês passado ou com diferença pequena, fica quieto", () => {
    expect(spendingPulse({ categoryId: "food", today: "2026-10-10", recurrences: [], categories: cats, transactions: [tx("food", "2026-10-01", 500)] })!.signals).toEqual([]);
    expect(spendingPulse({ categoryId: "food", today: "2026-10-10", recurrences: [], categories: cats, transactions: [tx("food", "2026-09-01", 100), tx("food", "2026-10-01", 140)] })!.signals).toEqual([]);
  });
  it("assinaturas: avisa quando são muitas ou caras", () => {
    const p = spendingPulse({ categoryId: "subs", today: "2026-10-10", categories: cats, transactions: [tx("subs", "2026-10-05", 40)],
      recurrences: [sub("Netflix", 55), sub("Spotify", 22), sub("Max", 35), sub("Prime", 20)] })!;
    expect(p.subscriptionsCount).toBe(4);
    expect(p.signals).toEqual([expect.stringMatching(/^4 assinaturas ativas somando R\$\s*132,00 por mês$/)]);
  });
  it("entrada não tem termômetro", () => {
    expect(spendingPulse({ categoryId: "sal", today: "2026-10-10", recurrences: [], categories: cats, transactions: [] })).toBeNull();
  });
});
