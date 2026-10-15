import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { DataStore } from "@/lib/data/store";
import type { Doc, DocFolder } from "@/lib/data/types";
import { buildCsv, buildPdf, ExportError, MAX_EXPORT_DOCS } from "./document-export";

const doc = (over: Partial<Doc> = {}): Doc => ({
  id: crypto.randomUUID(), folderId: null, title: "Consulta", issuer: "Dra. Roberta Lima", beneficiary: "Ana", category: "Consulta", docDate: "2026-10-05", amountCents: 35000,
  status: "pending", dueOn: "2026-11-04", submittedOn: null, reimbursedOn: null, alertStage: 0, notes: null, fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 1000,
  source: "web", createdAt: "2026-10-06T10:00:00Z", ...over,
});
const folders: DocFolder[] = [{ id: "f1", name: "Convênio", deadlineDays: 30, createdAt: "" }];

describe("planilha", () => {
  it("começa com BOM, separa por ponto e vírgula, usa vírgula decimal e fecha com o total", () => {
    const csv = buildCsv([doc({ folderId: "f1" }), doc({ title: "Jantar", issuer: null, beneficiary: null, amountCents: 18750, status: "submitted", submittedOn: "2026-10-12", docDate: "2026-10-06" })], folders);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe("Data;Nome;Emitido por;Para quem;Categoria;Pasta;Valor (R$);Situação;Prazo;Enviado em;Reembolsado em;Arquivo");
    expect(lines[1]).toBe("05/10/2026;Consulta;Dra. Roberta Lima;Ana;Consulta;Convênio;350,00;Pendente;04/11/2026;;;a.jpg");
    expect(lines[2]).toBe("06/10/2026;Jantar;;;Consulta;;187,50;Enviado;;12/10/2026;;a.jpg");
    expect(lines[3]).toBe(";TOTAL;;;;;537,50;;;;;");
  });
  it("nome com ponto e vírgula, aspas ou quebra de linha vai entre aspas", () => {
    const csv = buildCsv([doc({ title: 'Nota "especial"; urgente\nsegunda linha' })], folders);
    expect(csv).toContain('"Nota ""especial""; urgente\nsegunda linha"');
  });
  it("texto que parece fórmula não roda no Excel", () => {
    const csv = buildCsv([doc({ title: "=HYPERLINK(\"http://x\")", issuer: "+55 11 9999", beneficiary: "@alguem" })], folders);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain(";'+55 11 9999;");
    expect(csv).toContain(";'@alguem;");
  });
  it("só guardado não mostra prazo e valor vazio fica vazio", () => {
    const csv = buildCsv([doc({ status: null, dueOn: "2026-11-04", amountCents: null })], folders);
    expect(csv).toContain(";;Só guardado;;;;a.jpg");
  });
});

async function jpeg() { return sharp({ create: { width: 600, height: 800, channels: 3, background: "#aa5522" } }).jpeg().toBuffer(); }
async function pdf(pages: number) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage([200, 200]);
  return Buffer.from(await d.save());
}

function storeWith(files: Record<string, { bytes: Buffer; mimeType: string }>) {
  return { readDocumentFile: async (id: string) => (files[id] ? { ...files[id], fileName: "x" } : null) } as unknown as DataStore;
}

describe("PDF único", () => {
  it("capa + uma página por foto + as páginas de cada PDF, na ordem pedida", async () => {
    const a = doc({ title: "Foto" }), b = doc({ title: "Recibo em PDF", mimeType: "application/pdf" }), c = doc({ title: "Outra foto" });
    const store = storeWith({ [a.id]: { bytes: await jpeg(), mimeType: "image/jpeg" }, [b.id]: { bytes: await pdf(3), mimeType: "application/pdf" }, [c.id]: { bytes: await jpeg(), mimeType: "image/jpeg" } });
    const out = await PDFDocument.load(await buildPdf(store, [a, b, c], folders, "Fernando"));
    expect(out.getPageCount()).toBe(1 + 1 + 3 + 1);  // capa, foto, 3 páginas, foto
  });
  it("capa que não cabe numa página continua na seguinte, e acento e emoji não quebram", async () => {
    const many = Array.from({ length: 70 }, (_, i) => doc({ title: `Nota ${i} ção ✅ 😀` }));
    const j = await jpeg();
    const store = storeWith(Object.fromEntries(many.map((d) => [d.id, { bytes: j, mimeType: "image/jpeg" }])));
    const out = await PDFDocument.load(await buildPdf(store, many, folders, "Zé da Conceição"));
    expect(out.getPageCount()).toBeGreaterThan(70 + 1);  // mais de uma página de capa
  });
  it("arquivo que sumiu ou PDF que não abre vira uma página de aviso, sem derrubar o resto", async () => {
    const ok = doc({ title: "Boa" }), gone = doc({ title: "Sumiu" }), broken = doc({ title: "Quebrado", mimeType: "application/pdf" });
    const store = storeWith({ [ok.id]: { bytes: await jpeg(), mimeType: "image/jpeg" }, [broken.id]: { bytes: Buffer.from("%PDF-1.4 lixo"), mimeType: "application/pdf" } });
    const out = await PDFDocument.load(await buildPdf(store, [ok, gone, broken], folders, "Ana"));
    expect(out.getPageCount()).toBe(1 + 3);
  });
  it("recusa lista vazia e mais de 100 documentos, e arquivos grandes demais", async () => {
    const store = storeWith({});
    await expect(buildPdf(store, [], folders, "Ana")).rejects.toBeInstanceOf(ExportError);
    await expect(buildPdf(store, Array.from({ length: MAX_EXPORT_DOCS + 1 }, () => doc()), folders, "Ana")).rejects.toThrow(/até 100/);
    await expect(buildPdf(store, [doc({ sizeBytes: 90 * 1024 * 1024 })], folders, "Ana")).rejects.toThrow(/80 MB/);
  });
});
