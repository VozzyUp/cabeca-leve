import { PDFDocument } from "pdf-lib";
import type { DataStore, DocumentInput, DocumentPatch } from "@/lib/data/store";
import { MAX_DOCUMENT_BYTES } from "@/lib/data/store";
import type { Doc, DocStatus } from "@/lib/data/types";
import { dueDateFor, followsFolderDeadline, statusPatch } from "@/lib/domain/documents";
import { ImageError, normalizeStoredImage } from "@/lib/image";
import { formatBytes, storageLimitBytes } from "@/lib/limits";
import { localDate } from "@/lib/time";

// Guardar documentos: valida o arquivo, confere o espaço do plano, deixa a IA ler os dados e grava.
// Usado pela tela (rota de envio) e pelo assistente (WhatsApp).

export const ALLOWED_DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_READ_PAGES = 10;  // a IA lê as primeiras páginas do PDF; o arquivo inteiro é guardado

// Erro com mensagem pronta para mostrar à pessoa
export class DocumentError extends Error {
  constructor(message: string, readonly code: "type" | "size" | "quota" | "invalid" = "invalid") { super(message); }
}

export type PreparedFile = { bytes: Buffer; mimeType: (typeof ALLOWED_DOC_TYPES)[number]; fileName: string };

const baseName = (name: string) => name.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) || "documento";

// Foto vira JPEG legível (até 2400 px); PDF só é conferido. O resto é recusado.
export async function prepareFile(bytes: Buffer, declaredType: string, fileName: string): Promise<PreparedFile> {
  if (!bytes.length) throw new DocumentError("O arquivo veio vazio.", "invalid");
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new DocumentError("Arquivo grande demais (até 25 MB).", "size");
  const type = declaredType.split(";")[0].trim().toLowerCase();
  if (type === "application/pdf") {
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new DocumentError("Esse PDF parece estar danificado. Tente exportar de novo.", "invalid");
    return { bytes, mimeType: "application/pdf", fileName: baseName(fileName) };
  }
  if (type.startsWith("image/")) {
    try {
      const img = await normalizeStoredImage(bytes);
      return { bytes: img.bytes, mimeType: "image/jpeg", fileName: baseName(fileName).replace(/\.[A-Za-z0-9]{2,5}$/, "") + ".jpg" };
    } catch (error) {
      if (error instanceof ImageError) throw new DocumentError(error.message, "invalid");
      throw error;
    }
  }
  throw new DocumentError("Só aceito foto (JPEG, PNG, WebP) e PDF.", "type");
}

// Só as primeiras páginas, para a IA ler sem pagar pelo PDF inteiro
export async function pdfForReading(bytes: Buffer): Promise<Buffer> {
  try {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    if (src.getPageCount() <= MAX_READ_PAGES) return bytes;
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, Array.from({ length: MAX_READ_PAGES }, (_, i) => i));
    pages.forEach((p) => out.addPage(p));
    return Buffer.from(await out.save());
  } catch {
    return bytes;  // PDF que o pdf-lib não abre: segue inteiro, a IA tenta
  }
}

export async function assertRoom(store: DataStore, size: number) {
  const settings = await store.getSettings();
  const limit = storageLimitBytes(settings.plan);
  const used = await store.documentBytesUsed();
  if (used + size > limit) {
    throw new DocumentError(`Seu espaço para documentos está cheio (${formatBytes(used)} de ${formatBytes(limit)}). Apague algum documento${settings.plan === "trial" || settings.plan === "none" ? " ou assine um plano para ter mais espaço" : ""}.`, "quota");
  }
  return { used, limit };
}

export type NewDocument = {
  folderId?: string | null; title: string; issuer?: string | null; beneficiary?: string | null; category?: string | null;
  docDate?: string | null; amountCents?: number | null; status?: DocStatus | null; dueOn?: string | null; notes?: string | null;
};

// Grava o arquivo já preparado. O prazo vem da pasta (data do documento + dias) quando não foi informado.
export async function saveDocument(store: DataStore, file: PreparedFile, data: NewDocument, source: Doc["source"]): Promise<Doc> {
  await assertRoom(store, file.bytes.length);
  const status = data.status === undefined ? "pending" : data.status;
  const folders = data.folderId ? await store.listDocFolders() : [];
  const folder = folders.find((f) => f.id === data.folderId);
  const docDate = data.docDate ?? null;
  const dueOn = status === "pending" ? data.dueOn ?? dueDateFor(docDate, folder?.deadlineDays ?? null) : null;
  const input: DocumentInput = {
    folderId: folder ? folder.id : null, title: data.title.trim().slice(0, 120) || file.fileName.slice(0, 120),
    issuer: data.issuer?.trim().slice(0, 120) || null, beneficiary: data.beneficiary?.trim().slice(0, 80) || null, category: data.category?.trim().slice(0, 60) || null,
    docDate, amountCents: data.amountCents ?? null, status, dueOn, notes: data.notes?.trim().slice(0, 2000) || null,
    fileName: file.fileName, mimeType: file.mimeType, source,
  };
  return store.addDocument(input, file.bytes);
}

// Edita um documento cuidando do que muda junto: datas ao trocar de status e prazo que acompanha a pasta
export async function changeDocument(store: DataStore, id: string, patch: DocumentPatch): Promise<Doc | null> {
  const docs = await store.listDocuments();
  const doc = docs.find((d) => d.id === id);
  if (!doc) return null;
  const next: DocumentPatch = { ...patch };
  const today = localDate(new Date(), store.timezone());
  if (patch.status !== undefined && patch.status !== doc.status) Object.assign(next, statusPatch(patch.status, doc, today));
  const folders = await store.listDocFolders();
  const moved = (patch.folderId !== undefined && patch.folderId !== doc.folderId) || (patch.docDate !== undefined && patch.docDate !== doc.docDate);
  if (moved && patch.dueOn === undefined && followsFolderDeadline(doc, folders)) {
    const folder = folders.find((f) => f.id === (patch.folderId !== undefined ? patch.folderId : doc.folderId));
    next.dueOn = dueDateFor(patch.docDate !== undefined ? patch.docDate : doc.docDate, folder?.deadlineDays ?? null);
  }
  if (patch.dueOn !== undefined && patch.dueOn !== doc.dueOn) next.alertStage = 0;
  const status = "status" in next ? next.status : doc.status;
  // voltou a pendente sem prazo: a pasta e a data sugerem um
  if (status === "pending" && patch.status !== undefined && patch.status !== doc.status && patch.dueOn === undefined && !doc.dueOn) {
    const folder = folders.find((f) => f.id === (next.folderId !== undefined ? next.folderId : doc.folderId));
    next.dueOn = dueDateFor(next.docDate !== undefined ? next.docDate : doc.docDate, folder?.deadlineDays ?? null);
  }
  // sem status não há prazo correndo
  if (status === null) next.dueOn = null;
  return store.updateDocument(id, next);
}

// Mudar o prazo padrão da pasta recalcula só os documentos pendentes que ainda seguiam o prazo antigo
export async function changeFolderDeadline(store: DataStore, folderId: string, deadlineDays: number | null) {
  const [folders, docs] = await Promise.all([store.listDocFolders(), store.listDocuments()]);
  const before = folders.find((f) => f.id === folderId);
  if (!before) return null;
  const oldDays = before.deadlineDays;  // lido antes de gravar: a pasta pode ser o mesmo objeto
  const updated = await store.updateDocFolder(folderId, { deadlineDays });
  for (const d of docs) {
    if (d.folderId !== folderId || d.status !== "pending") continue;
    if (dueDateFor(d.docDate, oldDays) !== d.dueOn) continue;  // ajustado à mão: não mexe
    await store.updateDocument(d.id, { dueOn: dueDateFor(d.docDate, deadlineDays), alertStage: 0 });
  }
  return updated;
}
