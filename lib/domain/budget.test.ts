import { describe, expect, it } from "vitest";
import type { Category, Transaction } from "@/lib/data/types";
import { budgetAlert, budgetStatus } from "./finance";

const cats: Category[] = [
  { id: "ali", name: "Alimentação", kind: "expense" },
  { id: "pad", name: "Padaria", kind: "expense", parentId: "ali" },
  { id: "tra", name: "Transporte", kind: "expense" },
];
const tx = (cents: number, categoryId: string, occurredOn = "2026-10-05", type: Transaction["type"] = "expense"): Transaction => ({
  id: `${cents}-${categoryId}-${occurredOn}`, type, amountCents: cents, occurredOn, description: "x", categoryId, accountId: "a",
  cardId: null, recurrenceId: null, paymentMethod: null, source: "chat", createdAt: "",
} as Transaction);

describe("tetos de gastos", () => {
  it("soma a categoria e as subcategorias, só do mês e só gastos", () => {
    const s = budgetStatus([tx(20000, "ali"), tx(10000, "pad"), tx(9900, "ali", "2026-09-30"), tx(5000, "tra"), tx(7000, "ali", "2026-10-06", "income")],
      cats, [{ categoryId: "ali", amountCents: 50000 }], "2026-10");
    expect(s).toEqual([{ categoryId: "ali", name: "Alimentação", limitCents: 50000, spentCents: 30000, ratio: 0.6, level: "ok" }]);
  });
  it("níveis: perto a partir de 80%, estourado a partir de 100%", () => {
    const b = [{ categoryId: "tra", amountCents: 10000 }];
    expect(budgetStatus([tx(8000, "tra")], cats, b, "2026-10")[0].level).toBe("near");
    expect(budgetStatus([tx(10000, "tra")], cats, b, "2026-10")[0].level).toBe("over");
  });
  it("avisa só quando cruza 80% ou 100%", () => {
    const b = [{ categoryId: "ali", amountCents: 50000 }];
    const near = budgetStatus([tx(30000, "ali"), tx(12000, "pad")], cats, b, "2026-10")[0];
    expect(budgetAlert(near, 12000)).toMatch(/^Alimentação: R\$\s420,00 de R\$\s500,00 \(84% do teto\)\. Faltam R\$\s80,00\.$/);
    expect(budgetAlert(near, 1000)).toBeNull();  // já estava acima de 80%
    const over = budgetStatus([tx(45000, "ali"), tx(6000, "ali")], cats, b, "2026-10")[0];
    expect(budgetAlert(over, 6000)).toMatch(/^Passou do teto de Alimentação/);
  });
});
