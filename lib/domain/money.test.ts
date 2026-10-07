import { describe, expect, it } from "vitest";
import type { CreditCard, InstallmentPurchase, Recurrence, Transaction } from "@/lib/data/types";
import { cardStatus, installmentForecast, installmentStatus, monthlyTotals, nextOccurrence, recurringSummary, variableSpending } from "./money";

const tx = (occurredOn: string, amountCents: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: crypto.randomUUID(), type: "expense", amountCents, occurredOn, description: "x", categoryId: "c1", accountId: "a",
  paymentMethod: "pix", source: "manual", createdAt: `${occurredOn}T12:00:00Z`, ...extra,
});
const cats = [{ id: "c1", name: "Alimentação", kind: "expense" as const }];

describe("variableSpending", () => {
  it("deixa os fixos de fora, projeta o mês e compara com o mesmo período do mês anterior", () => {
    const s = variableSpending([
      tx("2026-10-01", 1000), tx("2026-10-02", 2000), tx("2026-10-02", 50000, { recurrenceId: "r" }),
      tx("2026-09-02", 700), tx("2026-09-20", 9999),
    ], cats, "2026-10", "2026-10-02");
    expect(s.totalCents).toBe(3000);
    expect(s.days).toEqual([{ day: "2026-10-01", cents: 1000 }, { day: "2026-10-02", cents: 2000 }]);
    expect(s.projectedCents).toBe(46500);   // 1500 por dia × 31
    expect(s.previousMonthCents).toBe(700); // só até o dia 2 de setembro
  });
});

describe("fixos", () => {
  it("próxima data: ainda este mês ou no próximo, ajustando dia 31 em mês curto", () => {
    expect(nextOccurrence(10, "2026-10-07")).toBe("2026-10-10");
    expect(nextOccurrence(5, "2026-10-07")).toBe("2026-11-05");
    expect(nextOccurrence(31, "2026-11-07")).toBe("2026-11-30");
  });
  it("soma só os ativos e marca o que já foi pago no mês", () => {
    const r = (id: string, kind: Recurrence["kind"], cents: number, active = true): Recurrence =>
      ({ id, kind, description: id, amountCents: cents, dayOfMonth: 5, categoryId: null, paymentMethod: "pix", active });
    const s = recurringSummary([r("sal", "income", 500000), r("alu", "bill", 150000), r("tv", "subscription", 5000, false)],
      [tx("2026-10-05", 150000, { recurrenceId: "alu" })], "2026-10-07");
    expect(s.monthlyBillsCents).toBe(150000);
    expect(s.committedShare).toBeCloseTo(0.3);
    expect(s.items.find((i) => i.id === "alu")!.paidThisMonth).toBe(true);
  });
});

describe("parcelas e cartão", () => {
  const p: InstallmentPurchase = { id: "p", description: "Notebook", totalCents: 100000, count: 3, firstMonth: "2026-09", cardId: "k", categoryId: null };
  it("conta parcelas pagas, resto e última parcela com o arredondamento", () => {
    const s = installmentStatus(p, "2026-10-07");
    expect(s.paid).toBe(2);
    expect(s.monthlyCents).toBe(33333);
    expect(s.remainingCents).toBe(33334);
    expect(s.lastMonth).toBe("2026-11");
    expect(installmentStatus(p, "2027-01-01").finished).toBe(true);
  });
  it("previsão mês a mês", () => {
    expect(installmentForecast([p], "2026-10-07", 3).map((m) => m.cents)).toEqual([33333, 33334, 0]);
  });
  it("fatura aberta: depois do fechamento, o ciclo vai até o próximo fechamento", () => {
    const card: CreditCard = { id: "k", name: "Cartão", limitCents: 500000, closingDay: 3, dueDay: 10 };
    const s = cardStatus(card, [
      tx("2026-10-03", 1000, { cardId: "k" }),  // ciclo anterior
      tx("2026-10-04", 2000, { cardId: "k" }),
      tx("2026-10-06", 3000, { cardId: "k" }),
    ], [p], "2026-10-07");
    expect(s.closesOn).toBe("2026-11-03");
    expect(s.dueOn).toBe("2026-11-10");
    expect(s.invoiceCents).toBe(5000 + 33334);  // compras do ciclo + parcela 3 (novembro)
    expect(s.availableCents).toBe(500000 - 5000 - 33334);
  });
});

describe("monthlyTotals", () => {
  it("separa fixos e variáveis por mês", () => {
    const m = monthlyTotals([tx("2026-10-01", 100), tx("2026-10-01", 900, { recurrenceId: "r" }), tx("2026-09-01", 50, { type: "income" })], "2026-10-07", 2);
    expect(m).toEqual([
      { month: "2026-09", incomeCents: 50, expenseCents: 0, fixedCents: 0, variableCents: 0 },
      { month: "2026-10", incomeCents: 0, expenseCents: 1000, fixedCents: 900, variableCents: 100 },
    ]);
  });
});
