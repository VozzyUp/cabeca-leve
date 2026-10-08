import { describe, expect, it } from "vitest";
import type { Habit, HabitLog, Transaction } from "@/lib/data/types";
import { dayItems } from "./day";
import { financeSummary } from "./finance";
import { habitHistory, habitStats } from "./habits";

const habit = (weekdays = [0, 1, 2, 3, 4, 5, 6]): Habit =>
  ({ id: "h", name: "Ler", weekdays, time: "21:00", active: true, createdAt: "2026-09-20T12:00:00Z" });
const logs = (...days: string[]): HabitLog[] => days.map((day) => ({ habitId: "h", day }));

describe("habitStats", () => {
  it("hoje ainda em aberto não quebra a sequência", () => {
    const s = habitStats(habit(), logs("2026-10-05", "2026-10-06"), "2026-10-07");
    expect(s.streak).toBe(2);
    expect(s.doneToday).toBe(false);
  });
  it("um dia planejado sem registro zera a sequência; o recorde fica", () => {
    const s = habitStats(habit(), logs("2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06", "2026-10-07"), "2026-10-07");
    expect(s.streak).toBe(3);
    expect(s.best).toBe(3);
  });
  it("dias não planejados não quebram (seg, qua, sex)", () => {
    // 2026-10-02 sex, 05 seg, 07 qua
    const s = habitStats(habit([1, 3, 5]), logs("2026-10-02", "2026-10-05", "2026-10-07"), "2026-10-07");
    expect(s.streak).toBe(3);
    expect(s.last7.filter((d) => d.scheduled).length).toBe(3);
  });
});

describe("financeSummary", () => {
  const tx = (type: Transaction["type"], cents: number, occurredOn: string, categoryId: string): Transaction =>
    ({ id: Math.random().toString(), type, amountCents: cents, occurredOn, description: "x", categoryId, accountId: "a", paymentMethod: null, source: "manual", createdAt: "" });
  const cats = [{ id: "c1", name: "Mercado", kind: "expense" as const }, { id: "c2", name: "Lazer", kind: "expense" as const }, { id: "c3", name: "Salário", kind: "income" as const }];
  it("soma o mês, agrupa por categoria e ignora outros meses", () => {
    const s = financeSummary([
      tx("income", 500000, "2026-10-01", "c3"), tx("expense", 30000, "2026-10-02", "c1"),
      tx("expense", 10000, "2026-10-05", "c2"), tx("expense", 99999, "2026-09-30", "c1"),
    ], cats, "2026-10", "2026-10-07");
    expect(s).toMatchObject({ incomeCents: 500000, expenseCents: 40000, leftoverCents: 460000, dailyAverageCents: 5714 });
    expect(s.byCategory.map((c) => [c.name, c.cents])).toEqual([["Mercado", 30000], ["Lazer", 10000]]);
  });
});

describe("dayItems", () => {
  it("ordena por horário e marca o que passou da hora", () => {
    const now = new Date("2026-10-07T17:00:00Z"); // 14:00 em Brasília
    const items = dayItems({
      now, tz: "America/Sao_Paulo",
      reminders: [{ id: "r", title: "Remédio", nextFireAt: "2026-10-07T12:00:00Z", recurrenceRule: null, channels: ["push"], status: "active", lastFiredAt: null, createdAt: "" }],
      tasks: [{ id: "t", title: "Atrasada", dueOn: "2026-10-05", priority: "high", status: "todo", notes: null, recurrenceRule: null, completedAt: null, createdAt: "" }],
      habits: [habit()], logs: [],
    });
    expect(items.map((i) => [i.title, i.time, i.overdue])).toEqual([["Remédio", "09:00", true], ["Ler", "21:00", false], ["Atrasada", null, true]]);
  });
});

describe("habitHistory", () => {
  it("taxa dos últimos 30 dias ignora hoje em aberto e dias antes de criar o hábito", () => {
    // criado em 20/09; feito em 6 dos 17 dias de 21/09 a 06/10 (+ 20/09)
    const h = habitHistory(habit(), logs("2026-09-20", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"), "2026-10-07");
    expect(h.total).toBe(6);
    expect(h.rate30).toBeCloseTo(6 / 17);
    expect(h.byWeekday[2].planned).toBeGreaterThan(0);  // terças
  });
});
