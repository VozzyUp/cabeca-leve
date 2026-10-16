// Validações dos dados que a Asaas exige no pagamento. Só aceitam o formato certo; quem chama manda sem máscara.

export const digits = (text: string) => text.replace(/\D/g, "");

function cpfOk(d: string) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const n of [9, 10]) {
    const sum = [...d.slice(0, n)].reduce((acc, c, i) => acc + Number(c) * (n + 1 - i), 0);
    if (((sum * 10) % 11) % 10 !== Number(d[n])) return false;
  }
  return true;
}

function cnpjOk(d: string) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  for (const n of [12, 13]) {
    const weights = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = [...d.slice(0, n)].reduce((acc, c, i) => acc + Number(c) * weights[i], 0);
    if ((sum % 11 < 2 ? 0 : 11 - (sum % 11)) !== Number(d[n])) return false;
  }
  return true;
}

export const isCpfCnpj = (text: string) => { const d = digits(text); return cpfOk(d) || cnpjOk(d); };
export const isCep = (text: string) => digits(text).length === 8;
// celular ou fixo com DDD, com ou sem o 55
export const isPhone = (text: string) => { const d = digits(text).replace(/^55(?=\d{10,11}$)/, ""); return /^[1-9]{2}9?\d{8}$/.test(d); };

export function luhnOk(text: string) {
  const d = digits(text);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  [...d].reverse().forEach((c, i) => { let n = Number(c); if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; });
  return sum % 10 === 0;
}

// "MM/AA" ou "MM/AAAA" -> { month, year } com 4 dígitos, ou null se não for uma validade que ainda vale
export function parseExpiry(text: string, now = new Date()): { month: string; year: string } | null {
  const m = /^\s*(\d{2})\s*\/?\s*(\d{2}|\d{4})\s*$/.exec(text);
  if (!m) return null;
  const month = Number(m[1]);
  const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (month < 1 || month > 12) return null;
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return null;
  return { month: String(month).padStart(2, "0"), year: String(year) };
}

export const isCvv = (text: string) => /^\d{3,4}$/.test(text.trim());

// Máscaras para digitar
export function maskCpfCnpj(text: string) {
  const d = digits(text).slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}
export const maskCep = (text: string) => digits(text).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
export function maskPhone(text: string) {
  const d = digits(text).slice(0, 11);
  return d.length <= 2 ? d : d.length <= 6 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d.length <= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export const maskCard = (text: string) => digits(text).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
export function maskExpiry(text: string) {
  const d = digits(text).slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}
