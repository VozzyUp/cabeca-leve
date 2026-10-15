import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { DataStore } from "@/lib/data/store";
import type { Doc, DocFolder } from "@/lib/data/types";
import { NO_STATUS_LABEL, STATUS_LABEL, totalsByStatus } from "@/lib/domain/documents";
import { formatMoney } from "@/lib/time";

// Exportar documentos para anexar num pedido de reembolso: um PDF único (capa com a lista e o total, depois cada
// nota na ordem) e uma planilha (CSV com ponto e vírgula e acentos certos, abre direto no Excel e no Google Planilhas).

export const MAX_EXPORT_DOCS = 100;
export const MAX_EXPORT_BYTES = 80 * 1024 * 1024;

export class ExportError extends Error {}

const brDate = (day: string | null) => (day ? day.split("-").reverse().join("/") : "");
const reais = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2).replace(".", ","));

// Planilha: uma linha por documento e o total no fim. Células que começariam com = + - @ levam um apóstrofo
// (fórmula escondida num nome de arquivo ou de médico não roda no Excel de quem abrir).
export function buildCsv(docs: Doc[], folders: DocFolder[]): string {
  const cell = (v: string | number | null) => {
    let t = v === null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+([.,]\d+)?$/.test(t)) t = `'${t}`;
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const header = ["Data", "Nome", "Emitido por", "Para quem", "Categoria", "Pasta", "Valor (R$)", "Situação", "Prazo", "Enviado em", "Reembolsado em", "Arquivo"];
  const rows = docs.map((d) => [
    brDate(d.docDate), d.title, d.issuer, d.beneficiary, d.category, folders.find((f) => f.id === d.folderId)?.name ?? "", reais(d.amountCents),
    d.status ? STATUS_LABEL[d.status] : NO_STATUS_LABEL, d.status === "pending" ? brDate(d.dueOn) : "", brDate(d.submittedOn), brDate(d.reimbursedOn), d.fileName,
  ]);
  const total = docs.reduce((n, d) => n + (d.amountCents ?? 0), 0);
  const lines = [header, ...rows, ["", "TOTAL", "", "", "", "", reais(total), "", "", "", "", ""]].map((r) => r.map(cell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;  // BOM para o Excel abrir em UTF-8
}

// pdf-lib só escreve Latin-1 com as fontes padrão: o que não cabe vira "?" (emoji, por exemplo)
const latin = (t: string) => t.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
const fit = (font: PDFFont, text: string, size: number, width: number) => {
  let t = latin(text);
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > width) t = `${t.slice(0, -2)}.`;
  return t;
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 40;

export async function buildPdf(store: DataStore, docs: Doc[], folders: DocFolder[], who: string): Promise<Buffer> {
  if (!docs.length) throw new ExportError("Escolha pelo menos um documento.");
  if (docs.length > MAX_EXPORT_DOCS) throw new ExportError(`Dá para exportar até ${MAX_EXPORT_DOCS} documentos por vez. Filtre por pasta ou situação e exporte em partes.`);
  if (docs.reduce((n, d) => n + d.sizeBytes, 0) > MAX_EXPORT_BYTES) throw new ExportError("Os arquivos somam mais de 80 MB. Exporte em partes.");

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const grey = rgb(0.4, 0.4, 0.4);
  const black = rgb(0.1, 0.1, 0.1);

  // capa: título, quem pediu, quando, lista numerada e total
  let page: PDFPage = out.addPage(A4);
  let y = A4[1] - MARGIN;
  const text = (t: string, x: number, size: number, f = font, color = black) => page.drawText(latin(t), { x, y, size, font: f, color });
  text("Documentos para reembolso", MARGIN, 20, bold); y -= 24;
  text(`${who} · gerado em ${brDate(new Date().toISOString().slice(0, 10))} · ${docs.length} ${docs.length === 1 ? "documento" : "documentos"}`, MARGIN, 10, font, grey); y -= 28;
  const cols = [MARGIN, MARGIN + 24, MARGIN + 74, MARGIN + 270, MARGIN + 380, A4[0] - MARGIN - 70];
  for (const [i, h] of ["#", "Data", "Nome / emitido por", "Para quem", "Situação", "Valor"].entries()) text(h, cols[i], 9, bold, grey);
  y -= 6; page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.5, color: grey }); y -= 14;
  for (const [i, d] of docs.entries()) {
    if (y < MARGIN + 60) { page = out.addPage(A4); y = A4[1] - MARGIN; }
    text(String(i + 1), cols[0], 9);
    text(brDate(d.docDate), cols[1], 9);
    text(fit(font, d.issuer ? `${d.title} · ${d.issuer}` : d.title, 9, cols[3] - cols[2] - 8), cols[2], 9);
    text(fit(font, d.beneficiary ?? "", 9, cols[4] - cols[3] - 8), cols[3], 9);
    text(d.status ? STATUS_LABEL[d.status] : NO_STATUS_LABEL, cols[4], 9);
    if (d.amountCents !== null) text(formatMoney(d.amountCents).replace(/ /g, " "), cols[5], 9);
    y -= 15;
  }
  y -= 4; page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.5, color: grey }); y -= 16;
  const t = totalsByStatus(docs);
  const total = docs.reduce((n, d) => n + (d.amountCents ?? 0), 0);
  text("Total", cols[4], 11, bold); text(formatMoney(total).replace(/ /g, " "), cols[5], 11, bold); y -= 16;
  for (const s of ["pending", "submitted", "reimbursed"] as const) if (t[s].count) { text(`${STATUS_LABEL[s]}: ${t[s].count} (${formatMoney(t[s].cents).replace(/ /g, " ")})`, cols[3], 9, font, grey); y -= 13; }

  // cada documento, na ordem da lista: foto numa página A4 com uma legenda; PDF com as páginas como vieram
  for (const [i, d] of docs.entries()) {
    const file = await store.readDocumentFile(d.id);
    const label = `${i + 1}/${docs.length} · ${d.title}${d.docDate ? ` · ${brDate(d.docDate)}` : ""}${d.amountCents !== null ? ` · ${formatMoney(d.amountCents).replace(/ /g, " ")}` : ""}`;
    if (file && file.mimeType === "application/pdf") {
      try {
        const src = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
        for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
        continue;
      } catch { /* cai na página de aviso abaixo */ }
    }
    const p = out.addPage(A4);
    p.drawText(fit(font, label, 9, A4[0] - 2 * MARGIN), { x: MARGIN, y: A4[1] - MARGIN + 10, size: 9, font, color: grey });
    if (file && file.mimeType !== "application/pdf") {
      const img = await out.embedJpg(file.bytes).catch(() => out.embedPng(file.bytes));
      const box = { w: A4[0] - 2 * MARGIN, h: A4[1] - 2 * MARGIN - 10 };
      const scale = Math.min(box.w / img.width, box.h / img.height, 1.5);
      p.drawImage(img, { x: MARGIN + (box.w - img.width * scale) / 2, y: A4[1] - MARGIN - img.height * scale, width: img.width * scale, height: img.height * scale });
    } else {
      p.drawText(fit(font, "Não consegui juntar este arquivo ao PDF. Baixe o original em Documentos.", 11, A4[0] - 2 * MARGIN), { x: MARGIN, y: A4[1] / 2, size: 11, font, color: black });
    }
  }
  return Buffer.from(await out.save());
}

export const exportName = (ext: "pdf" | "csv", today: string) => `reembolso-${today}.${ext}`;
