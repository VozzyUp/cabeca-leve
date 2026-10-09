import { describe, expect, it } from "vitest";
import type { Recurrence, Transaction } from "@/lib/data/types";
import { toResolve } from "./resolve";

const rec = (id: string, description: string, dayOfMonth: number, over: Partial<Recurrence> = {}): Recurrence =>
  ({ id, kind: "bill", description, amountCents: 10_000, dayOfMonth, categoryId: null, paymentMethod: "pix", active: true, ...over });
const paid = (recurrenceId: string, occurredOn: string): Transaction =>
  ({ id: `t-${recurrenceId}-${occurredOn}`, type: "expense", amountCents: 10_000, occurredOn, description: "x", categoryId: null, accountId: "a", paymentMethod: "pix", source: "manual", recurrenceId, createdAt: "" });

describe("a resolver", () => {
  const today = "2026-10-12";

  it("atrasadas primeiro (a mais antiga antes), depois hoje e as que vencem nos próximos 7 dias", () => {
    const out = toResolve([
      rec("a", "Internet", 20), rec("b", "Aluguel", 5), rec("c", "Luz", 12), rec("d", "Condomínio", 8), rec("e", "Academia", 30),
    ], [], today);
    expect(out.map((p) => [p.description, p.status, p.days])).toEqual([["Aluguel", "late", 7], ["Condomínio", "late", 4], ["Luz", "today", 0]]);
    expect(out.find((p) => p.description === "Internet")).toBeUndefined();  // dia 20 está a 8 dias: fora da janela de 7
    expect(out.find((p) => p.description === "Academia")).toBeUndefined();  // dia 30: longe
    expect(toResolve([rec("a", "Internet", 17)], [], today)).toEqual([expect.objectContaining({ status: "soon", days: 5 })]);
  });

  it("conta com lançamento ligado a ela no mês está resolvida; de outro mês não conta", () => {
    const out = toResolve([rec("a", "Aluguel", 5), rec("b", "Luz", 8)], [paid("a", "2026-10-05"), paid("b", "2026-09-08")], today);
    expect(out.map((p) => p.description)).toEqual(["Luz"]);
  });

  it("conta pausada não entra; entrada esperada entra como entrada", () => {
    const out = toResolve([rec("a", "Aluguel", 5, { active: false }), rec("b", "Salário", 10, { kind: "income", amountCents: 500_000 })], [], today);
    expect(out).toEqual([expect.objectContaining({ description: "Salário", kind: "income", status: "late", days: 2 })]);
  });

  it("vencimento anterior ao dia em que a conta foi cadastrada não conta como atrasado", () => {
    const out = toResolve([rec("a", "Aluguel", 5, { createdOn: "2026-10-10" }), rec("b", "Luz", 8, { createdOn: "2026-10-01" })], [], today);
    expect(out.map((p) => p.description)).toEqual(["Luz"]);
  });

  it("perto da virada do mês, o vencimento do mês que vem já aparece; dia 31 vira o último dia do mês curto", () => {
    const out = toResolve([rec("a", "Aluguel", 3, { createdOn: "2026-10-15" }), rec("b", "Plano", 31)], [], "2026-10-29");
    expect(out.map((p) => [p.description, p.dueOn, p.status])).toEqual([["Plano", "2026-10-31", "soon"], ["Aluguel", "2026-11-03", "soon"]]);
    const nov = toResolve([rec("b", "Plano", 31)], [], "2026-11-26");
    expect(nov).toEqual([expect.objectContaining({ dueOn: "2026-11-30", status: "soon", days: 4 })]);
  });
});
