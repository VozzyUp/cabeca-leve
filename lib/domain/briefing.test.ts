import { describe, expect, it } from "vitest";
import type { Recurrence } from "@/lib/data/types";
import { buildBriefing } from "./briefing";
import type { DayItem } from "./day";

const item = (kind: DayItem["kind"], title: string, extra: Partial<DayItem> = {}): DayItem =>
  ({ id: title, kind, title, time: null, done: false, overdue: false, href: "/", ...extra });
const bill = (description: string, dayOfMonth: number): Recurrence =>
  ({ id: description, kind: "bill", description, amountCents: 12000, dayOfMonth, categoryId: null, paymentMethod: "pix", active: true });

describe("buildBriefing", () => {
  it("junta o essencial numa frase e lista as contas dos próximos 3 dias", () => {
    const b = buildBriefing({
      name: "Ana", hour: 7, today: "2026-10-07",
      items: [item("event", "Reunião", { time: "10:00" }), item("task", "Orçamento"), item("task", "E-mail", { overdue: true })],
      recurrences: [bill("Internet", 9), bill("Aluguel", 20)], monthSpentCents: 30000, lastMonthSamePeriodCents: 40000,
    });
    expect(b.greeting).toBe("Bom dia, Ana.");
    expect(b.summary).toBe("Hoje você tem 1 compromisso, 2 tarefas e 1 conta para pagar.");
    expect(b.sections.find((s) => s.title === "Tarefas")!.lines[0]).toBe("E-mail (atrasada)");
    const money = b.sections.find((s) => s.title === "Dinheiro")!.lines;
    expect(money[0]).toMatch(/^Internet, R\$\s120,00, vence dia 9$/);
    expect(money[1]).toContain("25% abaixo");
  });
  it("dia livre", () => {
    const b = buildBriefing({ name: "Ana", hour: 20, today: "2026-10-07", items: [], recurrences: [], monthSpentCents: 0, lastMonthSamePeriodCents: 0 });
    expect(b.greeting).toBe("Boa noite, Ana.");
    expect(b.summary).toMatch(/^Dia livre/);
    expect(b.sections).toEqual([]);
  });
});
