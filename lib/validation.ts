import { z } from "zod";
import { parseRRule } from "@/lib/domain/recurrence";

// Regra de repetição aceita pelas rotas: só o subconjunto que sabemos calcular
export const rrule = z.string().max(120).refine((r) => parseRRule(r) !== null, "Repetição inválida");

// Destino depois de entrar ou confirmar o e-mail: só caminhos do próprio app.
// Resolve como o navegador resolveria ("/\evil.com" vira "//evil.com") e confere a origem.
export function safeAppPath(raw: unknown, fallback = "/conversa"): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return fallback;
  try {
    const url = new URL(raw, "http://app.local");
    return url.origin === "http://app.local" ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
