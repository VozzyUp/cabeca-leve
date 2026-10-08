import { z } from "zod";
import { parseRRule } from "@/lib/domain/recurrence";

// Regra de repetição aceita pelas rotas: só o subconjunto que sabemos calcular
export const rrule = z.string().max(120).refine((r) => parseRRule(r) !== null, "Repetição inválida");
