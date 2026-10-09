import { describe, expect, it } from "vitest";
import { describeRepeat, nextDate, nextFireAt, parseRRule, reopenFireAt, toRRule } from "./recurrence";

describe("repetição", () => {
  it("converte para RRULE e de volta", () => {
    const r = toRRule({ freq: "weekly", interval: 1, weekdays: [5, 1, 3] });
    expect(r).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR");
    expect(parseRRule(r)).toEqual({ freq: "weekly", interval: 1, weekdays: [1, 3, 5] });
    expect(parseRRule("FREQ=YEARLY")).toBeNull();
  });
  it("descreve em português", () => {
    expect(describeRepeat("FREQ=DAILY;INTERVAL=1")).toBe("todo dia");
    expect(describeRepeat("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR")).toBe("dias úteis");
    expect(describeRepeat("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH")).toBe("toda seg, qui");
    expect(describeRepeat("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5")).toBe("todo mês no dia 5");
    expect(describeRepeat("FREQ=DAILY;INTERVAL=3")).toBe("a cada 3 dias");
  });
  it("próxima data: diária, semanal com intervalo e mensal com dia 31", () => {
    expect(nextDate("FREQ=DAILY;INTERVAL=1", "2026-10-08", "2026-10-01")).toBe("2026-10-09");
    expect(nextDate("FREQ=DAILY;INTERVAL=3", "2026-10-08", "2026-10-01")).toBe("2026-10-10");
    // quinta 08/10; próxima segunda ou quarta
    expect(nextDate("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE", "2026-10-08", "2026-10-05")).toBe("2026-10-12");
    // a cada 2 semanas, âncora na segunda 05/10: pula a semana de 12/10
    expect(nextDate("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "2026-10-05", "2026-10-05")).toBe("2026-10-19");
    expect(nextDate("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31", "2026-10-31", "2026-10-31")).toBe("2026-11-30");
    expect(nextDate("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31", "2026-11-30", "2026-10-31")).toBe("2026-12-31");
  });
  it("próximo aviso mantém o horário local e não acumula ocorrências perdidas", () => {
    // todo dia às 08:00 em São Paulo; o último foi em 01/10 e agora é 08/10 10:00
    const next = nextFireAt("FREQ=DAILY;INTERVAL=1", "2026-10-01T11:00:00.000Z", "America/Sao_Paulo", new Date("2026-10-08T13:00:00Z"));
    expect(next).toBe("2026-10-09T11:00:00.000Z");
  });
  it("reabrir um lembrete sempre dá uma data de aviso (o banco não aceita ativo sem data)", () => {
    const now = new Date("2026-10-08T13:00:00Z");  // quinta 10:00 em São Paulo
    const tz = "America/Sao_Paulo";
    expect(reopenFireAt(null, "2026-10-09T20:00:00.000Z", tz, now)).toBe("2026-10-09T20:00:00.000Z");  // ainda no futuro: vale
    expect(reopenFireAt("FREQ=WEEKLY;INTERVAL=1;BYDAY=WE", "2026-10-07T13:30:00.000Z", tz, now)).toBe("2026-10-14T13:30:00.000Z");  // repete: próxima quarta, mesmo horário
    expect(reopenFireAt(null, "2026-10-07T13:30:00.000Z", tz, now)).toBe("2026-10-07T13:30:00.000Z");  // passou e não repete: fica atrasado
    expect(reopenFireAt(null, null, tz, now)).toBe("2026-10-08T14:00:00.000Z");  // sem data guardada: próxima hora cheia
    const rec = reopenFireAt("FREQ=WEEKLY;INTERVAL=1;BYDAY=WE", null, tz, now);
    expect(new Date(rec).getTime()).toBeGreaterThan(now.getTime());
  });
});
