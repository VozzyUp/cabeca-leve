import type { Doc, DocFolder, DocStatus } from "@/lib/data/types";
import { addDays } from "@/lib/time";

// Regras dos documentos (notas, recibos, pedidos): prazo, filtros, totais e aviso de vencimento.
// Tudo puro, sem banco: o que aparece na tela e o que o assistente responde vêm daqui.

export const STATUS_LABEL: Record<DocStatus, string> = { pending: "Pendente", submitted: "Enviado", reimbursed: "Reembolsado" };
export const STATUS_ORDER: DocStatus[] = ["pending", "submitted", "reimbursed"];
export const NO_STATUS_LABEL = "Só guardado";
export const ALERT_DAYS = [7, 2] as const;  // avisa 7 e 2 dias antes do prazo

// Prazo padrão da pasta: N dias depois da data do documento
export function dueDateFor(docDate: string | null, deadlineDays: number | null): string | null {
  return docDate && deadlineDays ? addDays(docDate, deadlineDays) : null;
}

const dayNumber = (day: string) => Math.round(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
export const daysUntil = (day: string, today: string) => dayNumber(day) - dayNumber(today);

export type Deadline = { state: "overdue" | "soon" | "ok"; days: number };

// Só o que está pendente tem prazo correndo
export function deadlineOf(doc: Pick<Doc, "status" | "dueOn">, today: string): Deadline | null {
  if (doc.status !== "pending" || !doc.dueOn) return null;
  const days = daysUntil(doc.dueOn, today);
  return { state: days < 0 ? "overdue" : days <= ALERT_DAYS[0] ? "soon" : "ok", days };
}

export function deadlineText(d: Deadline): string {
  if (d.days < 0) return d.days === -1 ? "venceu ontem" : `venceu há ${-d.days} dias`;
  if (d.days === 0) return "vence hoje";
  return d.days === 1 ? "vence amanhã" : `vence em ${d.days} dias`;
}

// Qual aviso mandar agora, se algum: o de 2 dias vale também para quem entrou na janela já em cima do prazo.
// Vencido não avisa de novo (já passou); o app mostra em vermelho.
export function nextAlertStage(doc: Pick<Doc, "status" | "dueOn" | "alertStage">, today: string): 1 | 2 | null {
  const d = deadlineOf(doc, today);
  if (!d || d.days < 0) return null;
  if (d.days <= ALERT_DAYS[1] && doc.alertStage < 2) return 2;
  if (d.days <= ALERT_DAYS[0] && doc.alertStage < 1) return 1;
  return null;
}

const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export type DocFilter = {
  folderId?: string | "none" | null;   // "none" = sem pasta
  status?: DocStatus | "open" | "stored" | null;  // open = pendente ou enviado (ainda não reembolsado); stored = sem status
  who?: string | null;                 // trecho do nome de quem emitiu ou de para quem foi
  query?: string | null;               // busca livre no título, emissor, para quem, categoria e observações
  from?: string | null;                // data do documento, AAAA-MM-DD
  to?: string | null;
};

export function filterDocs(docs: Doc[], f: DocFilter): Doc[] {
  const who = f.who ? plain(f.who.trim()) : "";
  const q = f.query ? plain(f.query.trim()) : "";
  return docs.filter((d) => {
    if (f.folderId === "none" ? d.folderId !== null : f.folderId ? d.folderId !== f.folderId : false) return false;
    if (f.status === "open" ? d.status !== "pending" && d.status !== "submitted" : f.status === "stored" ? d.status !== null : f.status ? d.status !== f.status : false) return false;
    if (who && !plain(`${d.issuer ?? ""} ${d.beneficiary ?? ""}`).includes(who)) return false;
    if (q && !plain(`${d.title} ${d.issuer ?? ""} ${d.beneficiary ?? ""} ${d.category ?? ""} ${d.notes ?? ""}`).includes(q)) return false;
    if (f.from && (!d.docDate || d.docDate < f.from)) return false;
    if (f.to && (!d.docDate || d.docDate > f.to)) return false;
    return true;
  });
}

// Mais urgente primeiro: prazo mais perto no topo; sem prazo, a data do documento mais recente
export function sortDocs(docs: Doc[]): Doc[] {
  return [...docs].sort((a, b) => {
    if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.dueOn !== b.dueOn) return a.dueOn ? -1 : 1;
    return (b.docDate ?? b.createdAt.slice(0, 10)).localeCompare(a.docDate ?? a.createdAt.slice(0, 10)) || b.createdAt.localeCompare(a.createdAt);
  });
}

export type StatusTotals = Record<DocStatus, { count: number; cents: number }>;

// Contagem e soma por status. Documento sem valor entra na contagem e soma zero.
export function totalsByStatus(docs: Doc[]): StatusTotals {
  const t: StatusTotals = { pending: { count: 0, cents: 0 }, submitted: { count: 0, cents: 0 }, reimbursed: { count: 0, cents: 0 } };
  for (const d of docs) {
    if (!d.status) continue;
    t[d.status].count++;
    t[d.status].cents += d.amountCents ?? 0;
  }
  return t;
}

// Troca de status: o que muda junto (datas e aviso de prazo)
export function statusPatch(to: DocStatus | null, doc: Pick<Doc, "submittedOn" | "reimbursedOn">, today: string) {
  return {
    status: to,
    submittedOn: to === "submitted" ? today : to === "reimbursed" ? doc.submittedOn ?? today : null,
    reimbursedOn: to === "reimbursed" ? today : null,
    alertStage: 0 as const,
  };
}

// Prazo automático: vale enquanto o prazo da nota ainda é o que a pasta sugeriria (ou não há prazo).
// Se a pessoa ajustou à mão, mudar de pasta ou de data não mexe nele.
export function followsFolderDeadline(doc: Pick<Doc, "dueOn" | "docDate" | "folderId">, folders: DocFolder[]): boolean {
  if (!doc.dueOn) return true;
  const folder = folders.find((f) => f.id === doc.folderId);
  return dueDateFor(doc.docDate, folder?.deadlineDays ?? null) === doc.dueOn;
}

// Valor digitado em reais -> centavos. Aceita "1.234,56", "187,5", "187.50" e "R$ 50". Vazio ou inválido: null.
export function parseReais(text: string): number | null {
  const t = text.replace(/R\$|\s/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const lastComma = t.lastIndexOf(","), lastDot = t.lastIndexOf(".");
  const decimal = Math.max(lastComma, lastDot);
  // o último separador é decimal se vier até 2 dígitos depois dele; senão é separador de milhar ("1.234")
  const isDecimal = decimal >= 0 && t.length - decimal - 1 <= 2 && !(lastComma >= 0 && lastDot >= 0 && lastDot > lastComma && t.length - lastDot - 1 === 3);
  const whole = (isDecimal ? t.slice(0, decimal) : t).replace(/[.,]/g, "");
  const frac = isDecimal ? t.slice(decimal + 1).padEnd(2, "0") : "00";
  const cents = Number(whole) * 100 + Number(frac);
  return Number.isFinite(cents) && cents <= 100_000_000_00 ? cents : null;
}

export const reaisText = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2).replace(".", ","));
