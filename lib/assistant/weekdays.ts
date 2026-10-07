const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function describeWeekdays(days: number[]): string {
  if (days.length === 7) return "todo dia";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "dias úteis";
  return [...days].sort().map((d) => WEEKDAY_SHORT[d]).join(", ");
}
