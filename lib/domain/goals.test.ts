import { describe, expect, it } from "vitest";
import type { Goal } from "@/lib/data/types";
import { goalPace } from "./goals";

const goal = (current: number, extra: Partial<Goal> = {}): Goal => ({
  id: "g", title: "Reserva", unit: "money", targetValue: 1000, currentValue: current, startOn: "2026-01-01", dueOn: "2026-12-31", ...extra,
});

describe("goalPace", () => {
  it("compara o avanço com o tempo decorrido", () => {
    // 1º de julho: ~50% do ano
    expect(goalPace(goal(500), "2026-07-02").status).toBe("on_track");
    expect(goalPace(goal(300), "2026-07-02").status).toBe("behind");
    expect(goalPace(goal(700), "2026-07-02").status).toBe("ahead");
  });
  it("calcula quanto falta por mês", () => {
    const p = goalPace(goal(400), "2026-10-01");
    expect(p.daysLeft).toBe(91);
    expect(p.perMonthNeeded).toBe(201); // 600 em ~3 meses, arredondado para cima
  });
  it("meta batida e meta sem prazo", () => {
    expect(goalPace(goal(1200), "2026-07-02").status).toBe("done");
    expect(goalPace(goal(10, { dueOn: null }), "2026-07-02").status).toBe("no_deadline");
  });
});
