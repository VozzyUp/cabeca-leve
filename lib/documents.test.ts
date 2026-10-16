import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { DataStore, DocumentInput, DocumentPatch } from "@/lib/data/store";
import type { Doc, DocFolder } from "@/lib/data/types";
import { assertRoom, changeDocument, changeFolderDeadline, DocumentError, pdfForReading, prepareFile, saveDocument } from "./documents";
import { formatBytes, storageLimitBytes } from "./limits";
import { DEFAULT_PLANS } from "./plans";

const MB = 1024 * 1024;

describe("espaço por plano", () => {
  it("o espaço vem do plano, em megabytes", () => {
    expect(storageLimitBytes(DEFAULT_PLANS[0])).toBe(100 * MB);
    expect(storageLimitBytes(DEFAULT_PLANS[1])).toBe(2048 * MB);
    expect(storageLimitBytes({ storageMb: 5000 })).toBe(5000 * MB);
  });
  it("escreve o tamanho em português", () => {
    expect(formatBytes(500)).toBe("1 KB");
    expect(formatBytes(300 * 1024)).toBe("300 KB");
    expect(formatBytes(2.5 * MB)).toBe("2,5 MB");
    expect(formatBytes(100 * MB)).toBe("100 MB");
    expect(formatBytes(2048 * MB)).toBe("2,0 GB");
  });
});

async function pdf(pages: number) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return Buffer.from(await doc.save());
}

describe("preparar o arquivo", () => {
  it("foto grande vira JPEG de até 2400 px, legível, sem metadados", async () => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#336699" } }).png().toBuffer();
    const out = await prepareFile(big, "image/png", "nota fiscal.PNG");
    expect(out.mimeType).toBe("image/jpeg");
    expect(out.fileName).toBe("nota fiscal.jpg");
    const meta = await sharp(out.bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBe(2400);
    expect(meta.exif).toBeUndefined();
  });
  it("foto pequena não é ampliada e PNG transparente ganha fundo branco", async () => {
    const small = await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const out = await prepareFile(small, "image/png", "a.png");
    const { data, info } = await sharp(out.bytes).raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(10);
    expect([data[0], data[1], data[2]].every((v) => v >= 250)).toBe(true);
  });
  it("PDF válido passa como está", async () => {
    const file = await pdf(2);
    const out = await prepareFile(file, "application/pdf", "recibo.pdf");
    expect(out.bytes.equals(file)).toBe(true);
    expect(out.mimeType).toBe("application/pdf");
  });
  it("recusa vazio, grande demais, tipo errado, PDF falso e foto quebrada", async () => {
    await expect(prepareFile(Buffer.alloc(0), "image/png", "a.png")).rejects.toThrow(/vazio/);
    await expect(prepareFile(Buffer.alloc(26 * MB), "application/pdf", "a.pdf")).rejects.toMatchObject({ code: "size" });
    await expect(prepareFile(Buffer.from("hello"), "text/plain", "a.txt")).rejects.toMatchObject({ code: "type" });
    await expect(prepareFile(Buffer.from("<html>"), "application/pdf", "a.pdf")).rejects.toThrow(/danificado/);
    await expect(prepareFile(Buffer.from("não sou uma foto"), "image/jpeg", "a.jpg")).rejects.toBeInstanceOf(DocumentError);
  });
  it("o nome do arquivo não carrega caminho nem caractere de controle", async () => {
    const out = await prepareFile(await pdf(1), "application/pdf", "../../etc/passwd\u0000.pdf");
    expect(out.fileName).not.toMatch(/[\\/\u0000]/);
  });
  it("PDF longo é cortado nas primeiras 10 páginas só para a IA ler", async () => {
    const long = await pdf(14);
    const cut = await PDFDocument.load(await pdfForReading(long));
    expect(cut.getPageCount()).toBe(10);
    const short = await pdf(3);
    expect((await pdfForReading(short)).equals(short)).toBe(true);
  });
});

// Loja mínima em memória: só o que documents.ts usa
function memoryStore(plan: "trial" | "monthly" = "trial", used = 0, folders: DocFolder[] = []) {
  const docs: Doc[] = [];
  const store = {
    timezone: () => "America/Sao_Paulo",
    getSettings: async () => ({ plan, planInfo: plan === "trial" ? DEFAULT_PLANS[0] : DEFAULT_PLANS[1] }),
    documentBytesUsed: async () => used + docs.reduce((n, d) => n + d.sizeBytes, 0),
    listDocFolders: async () => folders,
    updateDocFolder: async (id: string, patch: { deadlineDays?: number | null }) => { const f = folders.find((x) => x.id === id)!; if (patch.deadlineDays !== undefined) f.deadlineDays = patch.deadlineDays; return f; },
    listDocuments: async () => docs,
    addDocument: async (input: DocumentInput, bytes: Buffer) => {
      const doc = { ...input, id: crypto.randomUUID(), submittedOn: null, reimbursedOn: null, alertStage: 0, sizeBytes: bytes.length, createdAt: new Date().toISOString() } as Doc;
      docs.push(doc);
      return doc;
    },
    updateDocument: async (id: string, patch: DocumentPatch) => { const d = docs.find((x) => x.id === id); if (!d) return null; Object.assign(d, patch); return d; },
  };
  return { store: store as unknown as DataStore, docs };
}

describe("espaço cheio", () => {
  it("recusa quando o arquivo não cabe e diz como resolver (teste sugere assinar)", async () => {
    const { store } = memoryStore("trial", 99 * MB);
    await expect(assertRoom(store, 2 * MB)).rejects.toThrow(/assine um plano/);
    await expect(assertRoom(store, 0.5 * MB)).resolves.toBeTruthy();
    const { store: paid } = memoryStore("monthly", 2047 * MB);
    const err = (await assertRoom(paid, 2 * MB).catch((e) => e)) as Error;
    expect(err.message).toMatch(/cheio/);
    expect(err.message).not.toMatch(/assine/);
  });
  it("não grava nada quando recusa", async () => {
    const { store, docs } = memoryStore("trial", 100 * MB);
    const file = await prepareFile(await pdf(1), "application/pdf", "a.pdf");
    await expect(saveDocument(store, file, { title: "x" }, "web")).rejects.toMatchObject({ code: "quota" });
    expect(docs).toHaveLength(0);
  });
});

describe("guardar e editar", () => {
  const folder: DocFolder = { id: "f1", name: "Convênio", deadlineDays: 30, createdAt: "" };

  it("o prazo vem da pasta (data do documento + dias) e só para o pendente", async () => {
    const { store } = memoryStore("trial", 0, [{ ...folder }]);
    const file = await prepareFile(await pdf(1), "application/pdf", "a.pdf");
    const pending = await saveDocument(store, file, { title: "Consulta", folderId: "f1", docDate: "2026-10-01" }, "web");
    expect(pending).toMatchObject({ status: "pending", dueOn: "2026-10-31", folderId: "f1" });
    const stored = await saveDocument(store, file, { title: "Pedido", folderId: "f1", docDate: "2026-10-01", status: null }, "web");
    expect(stored).toMatchObject({ status: null, dueOn: null });
    const manual = await saveDocument(store, file, { title: "Exame", folderId: "f1", docDate: "2026-10-01", dueOn: "2026-12-01" }, "web");
    expect(manual.dueOn).toBe("2026-12-01");
  });
  it("pasta que não existe é ignorada, não vira erro", async () => {
    const { store } = memoryStore();
    const file = await prepareFile(await pdf(1), "application/pdf", "a.pdf");
    expect((await saveDocument(store, file, { title: "x", folderId: "nao-existe" }, "whatsapp")).folderId).toBeNull();
  });
  it("trocar de status ajusta as datas; voltar para pendente limpa", async () => {
    const { store } = memoryStore("trial", 0, [{ ...folder }]);
    const file = await prepareFile(await pdf(1), "application/pdf", "a.pdf");
    const doc = await saveDocument(store, file, { title: "Consulta", folderId: "f1", docDate: "2026-10-01" }, "web");
    const sent = await changeDocument(store, doc.id, { status: "submitted" });
    expect(sent!.status).toBe("submitted");
    expect(sent!.submittedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const paid = await changeDocument(store, doc.id, { status: "reimbursed" });
    expect(paid!.reimbursedOn).toBeTruthy();
    expect(paid!.submittedOn).toBe(sent!.submittedOn);
    const back = await changeDocument(store, doc.id, { status: "pending" });
    expect(back).toMatchObject({ submittedOn: null, reimbursedOn: null, alertStage: 0 });
  });
  it("mudar a data ou a pasta recalcula o prazo automático, mas não o ajustado à mão", async () => {
    const other: DocFolder = { id: "f2", name: "Viagem", deadlineDays: 10, createdAt: "" };
    const { store } = memoryStore("trial", 0, [{ ...folder }, other]);
    const file = await prepareFile(await pdf(1), "application/pdf", "a.pdf");
    const auto = await saveDocument(store, file, { title: "A", folderId: "f1", docDate: "2026-10-01" }, "web");
    expect((await changeDocument(store, auto.id, { docDate: "2026-10-05" }))!.dueOn).toBe("2026-11-04");
    expect((await changeDocument(store, auto.id, { folderId: "f2" }))!.dueOn).toBe("2026-10-15");
    const hand = await saveDocument(store, file, { title: "B", folderId: "f1", docDate: "2026-10-01", dueOn: "2026-12-25" }, "web");
    expect((await changeDocument(store, hand.id, { folderId: "f2" }))!.dueOn).toBe("2026-12-25");
  });
  it("mudar o prazo à mão zera o aviso já enviado; virar 'só guardado' tira o prazo", async () => {
    const { store, docs } = memoryStore();
    const file = await prepareFile(await pdf(1), "application/pdf", "a.pdf");
    const doc = await saveDocument(store, file, { title: "A", dueOn: "2026-10-20" }, "web");
    docs[0].alertStage = 1;
    expect((await changeDocument(store, doc.id, { dueOn: "2026-11-20" }))!.alertStage).toBe(0);
    expect((await changeDocument(store, doc.id, { status: null }))!.dueOn).toBeNull();
    expect(await changeDocument(store, "inexistente", { title: "x" })).toBeNull();
  });
  it("mudar o prazo da pasta recalcula só os pendentes que seguiam o prazo antigo", async () => {
    const { store } = memoryStore("trial", 0, [{ ...folder }]);
    const file = await prepareFile(await pdf(1), "application/pdf", "a.pdf");
    const follows = await saveDocument(store, file, { title: "A", folderId: "f1", docDate: "2026-10-01" }, "web");
    const hand = await saveDocument(store, file, { title: "B", folderId: "f1", docDate: "2026-10-01", dueOn: "2026-12-25" }, "web");
    const done = await saveDocument(store, file, { title: "C", folderId: "f1", docDate: "2026-10-01", status: "reimbursed" }, "web");
    await changeFolderDeadline(store, "f1", 60);
    const byId = Object.fromEntries((await store.listDocuments()).map((d) => [d.id, d]));
    expect(byId[follows.id].dueOn).toBe("2026-11-30");
    expect(byId[hand.id].dueOn).toBe("2026-12-25");
    expect(byId[done.id].dueOn).toBeNull();
  });
});
