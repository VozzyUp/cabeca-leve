import { describe, expect, it } from "vitest";
import { buildReviewContext, type ReviewData } from "./review";

const base: ReviewData = { tasks: [], projects: [], habits: [], habitLogs: [], goals: [], transactions: [], categories: [], budgets: [], notes: [] };
const o = { now: new Date("2026-10-09T15:00:00Z"), tz: "America/Sao_Paulo", lookbackDays: 7 };
const task = (title: string, dueOn: string | null, status: "todo" | "done" = "todo", completedAt: string | null = null) =>
  ({ id: title, title, dueOn, priority: "medium" as const, status, notes: null, recurrenceRule: null, completedAt, createdAt: "2026-10-01T00:00:00Z" });

describe("contexto da revisão agendada", () => {
  it("sem nada nas fontes escolhidas devolve null (nem chama a IA)", () => {
    expect(buildReviewContext(["tasks", "finance", "goals"], base, o)).toBeNull();
    // dados de uma fonte não escolhida não contam
    expect(buildReviewContext(["tasks"], { ...base, goals: [{ id: "g", title: "Meta", unit: "count", targetValue: 10, currentValue: 3, startOn: "2026-01-01", dueOn: null }] }, o)).toBeNull();
  });

  it("tarefas: atrasadas, de hoje, próximas e concluídas na janela", () => {
    const text = buildReviewContext(["tasks"], { ...base, tasks: [
      task("Pagar luz", "2026-10-07"), task("Ligar para o banco", "2026-10-09"), task("Renovar CNH", "2026-10-12"),
      task("Enviar relatório", "2026-10-05", "done", "2026-10-08T14:00:00Z"), task("Antiga concluída", null, "done", "2026-09-01T14:00:00Z"),
    ] }, o)!;
    expect(text).toContain("Atrasadas (1): Pagar luz (era 7 de out.)");
    expect(text).toContain("Para hoje (1): Ligar para o banco");
    expect(text).toContain("Nos próximos 7 dias (1): Renovar CNH (12 de out.)");
    expect(text).toContain("Concluídas nos últimos 7 dias (1): Enviar relatório");
    expect(text).not.toContain("Antiga concluída");
  });

  it("hábitos contam dias previstos na janela; metas mostram o percentual; dinheiro soma e aponta tetos", () => {
    const text = buildReviewContext(["habits", "goals", "finance"], {
      ...base,
      habits: [{ id: "h", name: "Treinar", weekdays: [1, 3, 5], time: null, active: true, createdAt: "2026-01-01T00:00:00Z" }],
      habitLogs: [{ habitId: "h", day: "2026-10-05" }, { habitId: "h", day: "2026-10-07" }, { habitId: "h", day: "2026-09-01" }],
      goals: [{ id: "g", title: "Juntar 20 mil", unit: "money", targetValue: 2_000_000, currentValue: 500_000, startOn: "2026-01-01", dueOn: "2026-12-31" }],
      categories: [{ id: "c1", name: "Alimentação", kind: "expense" }, { id: "c2", name: "Salário", kind: "income" }],
      budgets: [{ categoryId: "c1", amountCents: 20_000 }],
      transactions: [
        { id: "t1", type: "expense", amountCents: 18_000, occurredOn: "2026-10-08", description: "iFood", categoryId: "c1", accountId: "a", paymentMethod: "pix", source: "chat", createdAt: "2026-10-08T00:00:00Z" },
        { id: "t2", type: "income", amountCents: 500_000, occurredOn: "2026-10-05", description: "Salário", categoryId: "c2", accountId: "a", paymentMethod: "pix", source: "chat", createdAt: "2026-10-05T00:00:00Z" },
      ],
    }, o)!;
    expect(text).toContain("Treinar: 2 de 3 dias previstos");  // seg 5/10, qua 7/10, sex 9/10 na janela
    expect(text).toContain("Juntar 20 mil");
    expect(text).toContain("(25%)");
    expect(text).toMatch(/entrou R\$\s5\.000,00, saiu R\$\s180,00/);
    expect(text).toMatch(/Teto de Alimentação: R\$\s180,00 de R\$\s200,00 \(90%\)/);
  });
});
