import { describe, expect, it } from "vitest";
import { nextAutomationRun } from "./automation";

const tz = "America/Sao_Paulo";  // UTC−3
const d = (s: string) => new Date(s);

describe("próxima revisão agendada", () => {
  it("diária: hoje se ainda não deu a hora, senão amanhã", () => {
    const a = { schedule: "daily" as const, weekdays: [], runOn: null, time: "07:00" };
    expect(nextAutomationRun(a, tz, d("2026-10-09T09:00:00Z"))?.toISOString()).toBe("2026-10-09T10:00:00.000Z");   // 6h locais: hoje às 7h
    expect(nextAutomationRun(a, tz, d("2026-10-09T10:00:00Z"))?.toISOString()).toBe("2026-10-10T10:00:00.000Z");   // exatamente 7h: já é a de hoje, vai para amanhã
    expect(nextAutomationRun(a, tz, d("2026-10-09T14:00:00Z"))?.toISOString()).toBe("2026-10-10T10:00:00.000Z");
  });
  it("semanal: só nos dias escolhidos, no horário local", () => {
    const a = { schedule: "weekly" as const, weekdays: [1, 5], runOn: null, time: "08:30" };  // segunda e sexta
    // sexta 9/10 às 12h locais (depois das 8h30): a próxima é segunda 12/10
    expect(nextAutomationRun(a, tz, d("2026-10-09T15:00:00Z"))?.toISOString()).toBe("2026-10-12T11:30:00.000Z");
    // quinta 8/10: a próxima é sexta 9/10
    expect(nextAutomationRun(a, tz, d("2026-10-08T15:00:00Z"))?.toISOString()).toBe("2026-10-09T11:30:00.000Z");
  });
  it("mensal: todo dia 1", () => {
    const a = { schedule: "monthly" as const, weekdays: [], runOn: null, time: "09:00" };
    expect(nextAutomationRun(a, tz, d("2026-10-09T15:00:00Z"))?.toISOString()).toBe("2026-11-01T12:00:00.000Z");
    expect(nextAutomationRun(a, tz, d("2026-12-15T15:00:00Z"))?.toISOString()).toBe("2027-01-01T12:00:00.000Z");
    expect(nextAutomationRun(a, tz, d("2026-10-01T10:00:00Z"))?.toISOString()).toBe("2026-10-01T12:00:00.000Z");  // dia 1 ainda antes da hora
  });
  it("uma vez: no dia marcado; depois que passou, acabou", () => {
    const a = { schedule: "once" as const, weekdays: [], runOn: "2026-10-20", time: "18:00" };
    expect(nextAutomationRun(a, tz, d("2026-10-09T15:00:00Z"))?.toISOString()).toBe("2026-10-20T21:00:00.000Z");
    expect(nextAutomationRun(a, tz, d("2026-10-21T00:00:00Z"))).toBeNull();
    expect(nextAutomationRun({ ...a, runOn: null }, tz, d("2026-10-09T15:00:00Z"))).toBeNull();
  });
});
