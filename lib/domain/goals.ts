import type { Goal } from "@/lib/data/types";

const dayMs = 86_400_000;
const toMs = (day: string) => Date.parse(`${day}T12:00:00Z`);

export type GoalPace = {
  share: number;                 // fração concluída (0 a 1)
  expectedShare: number | null;  // onde deveria estar pelo tempo decorrido
  status: "done" | "ahead" | "on_track" | "behind" | "no_deadline";
  daysLeft: number | null;
  perMonthNeeded: number | null; // quanto falta por mês para chegar no prazo (mesma unidade da meta)
};

// Ritmo da meta: compara o avanço com o tempo decorrido entre o início e o prazo.
// Até 5 pontos percentuais de diferença conta como "no ritmo".
export function goalPace(goal: Goal, today: string): GoalPace {
  const share = goal.targetValue ? Math.min(1, goal.currentValue / goal.targetValue) : 0;
  if (share >= 1) return { share: 1, expectedShare: null, status: "done", daysLeft: null, perMonthNeeded: null };
  if (!goal.dueOn) return { share, expectedShare: null, status: "no_deadline", daysLeft: null, perMonthNeeded: null };
  const total = Math.max(1, (toMs(goal.dueOn) - toMs(goal.startOn)) / dayMs);
  const elapsed = Math.min(total, Math.max(0, (toMs(today) - toMs(goal.startOn)) / dayMs));
  const expected = elapsed / total;
  const daysLeft = Math.max(0, Math.round((toMs(goal.dueOn) - toMs(today)) / dayMs));
  const monthsLeft = Math.max(1, daysLeft / 30.4);
  const diff = share - expected;
  return {
    share,
    expectedShare: expected,
    status: diff > 0.05 ? "ahead" : diff < -0.05 ? "behind" : "on_track",
    daysLeft,
    perMonthNeeded: Math.ceil((goal.targetValue - goal.currentValue) / monthsLeft),
  };
}
