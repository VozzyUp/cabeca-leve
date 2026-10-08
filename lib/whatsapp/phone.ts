// Números do WhatsApp em dígitos, com DDI (5511987654321).
export const digitsOnly = (s: string) => s.replace(/\D/g, "");

// Celulares do Brasil às vezes chegam do WhatsApp sem o 9 depois do DDD (55 11 8765-4321).
// Para comparar com o número que a pessoa cadastrou, gera as duas formas.
export function phoneVariants(digits: string): string[] {
  const d = digitsOnly(digits);
  const out = new Set([d]);
  if (/^55\d{2}9\d{8}$/.test(d)) out.add(d.slice(0, 4) + d.slice(5));       // tira o 9
  if (/^55\d{2}[6-9]\d{7}$/.test(d)) out.add(`${d.slice(0, 4)}9${d.slice(4)}`); // põe o 9
  return [...out];
}

export const toE164 = (digits: string) => `+${digitsOnly(digits)}`;
