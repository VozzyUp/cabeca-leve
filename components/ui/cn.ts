import { extendTailwindMerge } from "tailwind-merge";

// text-label e text-metric são tipos nossos (globals.css), não cores: o merge
// precisa saber disso para não descartá-los ao lado de text-muted, text-income...
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["label", "metric"] }] } },
});

// Junta classes condicionais; em conflito (p-4 x p-0), a última vence
export function cn(...parts: Array<string | false | null | undefined>) {
  return twMerge(parts.filter(Boolean).join(" "));
}
