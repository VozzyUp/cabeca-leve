import type { DataStore } from "@/lib/data/store";
import type { ActionCardData, Doc, DocFolder, DocStatus } from "@/lib/data/types";
import { deadlineOf, deadlineText, filterDocs, NO_STATUS_LABEL, sortDocs, STATUS_LABEL, totalsByStatus, type DocFilter } from "@/lib/domain/documents";
import { changeDocument, changeFolderDeadline, DocumentError, saveDocument } from "@/lib/documents";
import { formatMoney, localDate } from "@/lib/time";

// Documentos pelo assistente (chat e WhatsApp): guardar o que chegou, achar, mudar o status e mandar o arquivo de volta.
// As contas (soma por status, quantidade) saem daqui, nunca de um palpite do modelo.

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_SEND = 10;

// Pasta pelo nome que a pessoa disse: igual (sem ligar para acento e caixa) ou, se só uma contiver o que ela falou, essa
export function matchFolder(folders: DocFolder[], name: string): DocFolder | null {
  const n = plain(name);
  if (!n) return null;
  const exact = folders.find((f) => plain(f.name) === n);
  if (exact) return exact;
  const partial = folders.filter((f) => plain(f.name).includes(n) || n.includes(plain(f.name)));
  return partial.length === 1 ? partial[0] : null;
}

async function folderByName(store: DataStore, name: string, create: { deadlineDays: number | null } | null): Promise<DocFolder | null> {
  const folders = await store.listDocFolders();
  const found = matchFolder(folders, name);
  if (found || !create) return found;
  try {
    return await store.createDocFolder({ name: name.trim().slice(0, 80), deadlineDays: create.deadlineDays });
  } catch {
    // outra mensagem criou a mesma pasta no meio tempo
    return matchFolder(await store.listDocFolders(), name);
  }
}

export type SaveInput = {
  fileRef: string; title: string; issuer: string | null; beneficiary: string | null; category: string | null; docDate: string | null;
  amountReais: number | null; folder: string | null; deadlineDays: number | null; reimbursable: boolean; notes: string | null;
};

// Guarda o arquivo estacionado como documento e devolve o card (com Desfazer, que apaga o documento e o arquivo)
export async function saveStagedDocument(store: DataStore, input: SaveInput, source: Doc["source"]): Promise<{ card: ActionCardData } | { error: string }> {
  const file = await store.readStagedFile(input.fileRef);
  if (!file) return { error: "Esse arquivo não está mais disponível (ele fica 24 horas). Peça para a pessoa mandar de novo." };
  const folder = input.folder ? await folderByName(store, input.folder, { deadlineDays: input.deadlineDays }) : null;
  try {
    const doc = await saveDocument(store, { bytes: file.bytes, mimeType: file.mimeType as "image/jpeg", fileName: file.fileName }, {
      folderId: folder?.id ?? null, title: input.title, issuer: input.issuer, beneficiary: input.beneficiary, category: input.category,
      docDate: input.docDate && DATE.test(input.docDate) ? input.docDate : null,
      amountCents: input.amountReais === null ? null : Math.round(input.amountReais * 100), status: input.reimbursable ? "pending" : null, notes: input.notes,
    }, source);
    await store.dropStagedFile(input.fileRef);
    const action = await store.recordAction("document", doc.id);
    const today = localDate(new Date(), store.timezone());
    const dl = deadlineOf(doc, today);
    const meta = [folder?.name ?? "sem pasta", doc.issuer, doc.beneficiary ? `para ${doc.beneficiary}` : null, doc.status ? STATUS_LABEL[doc.status] : NO_STATUS_LABEL, dl ? deadlineText(dl) : null].filter(Boolean).join(" · ");
    return { card: { actionId: action.id, kind: "document", title: doc.title, value: doc.amountCents === null ? "" : formatMoney(doc.amountCents), valueTone: "neutral", meta, href: "/documentos", undone: false } };
  } catch (error) {
    if (error instanceof DocumentError) return { error: error.message };
    throw error;
  }
}

export async function setFolder(store: DataStore, name: string, deadlineDays: number | null | undefined) {
  const folders = await store.listDocFolders();
  const found = matchFolder(folders, name);
  if (found) {
    if (deadlineDays !== undefined) await changeFolderDeadline(store, found.id, deadlineDays);
    return { ok: true, folder: found.name, created: false, deadline_days: deadlineDays === undefined ? found.deadlineDays : deadlineDays };
  }
  const folder = await store.createDocFolder({ name: name.trim().slice(0, 80), deadlineDays: deadlineDays ?? null });
  return { ok: true, folder: folder.name, created: true, deadline_days: folder.deadlineDays };
}

export type FindInput = { who: string | null; query: string | null; status: DocStatus | "open" | "stored" | null; folder: string | null; from: string | null; to: string | null };

const row = (d: Doc, folders: DocFolder[], today: string) => {
  const dl = deadlineOf(d, today);
  return {
    id: d.id, title: d.title, issuer: d.issuer, beneficiary: d.beneficiary, category: d.category, date: d.docDate,
    amount: d.amountCents === null ? null : formatMoney(d.amountCents), status: d.status ? STATUS_LABEL[d.status] : NO_STATUS_LABEL,
    folder: folders.find((f) => f.id === d.folderId)?.name ?? null, due_on: d.status === "pending" ? d.dueOn : null, deadline: dl ? deadlineText(dl) : null,
  };
};

// Lista os documentos que combinam (no máximo 25, o mais urgente primeiro) com a contagem e a soma de todos os que combinam
export async function findDocuments(store: DataStore, input: FindInput) {
  const [docs, folders] = await Promise.all([store.listDocuments(), store.listDocFolders()]);
  let folderId: string | "none" | null = null;
  if (input.folder) {
    if (plain(input.folder) === "sem pasta") folderId = "none";
    else {
      const f = matchFolder(folders, input.folder);
      if (!f) return { count: 0, note: `Não existe pasta "${input.folder}". Pastas: ${folders.map((x) => x.name).join(", ") || "nenhuma"}.`, documents: [] };
      folderId = f.id;
    }
  }
  const filter: DocFilter = { folderId, status: input.status, who: input.who, query: input.query, from: input.from && DATE.test(input.from) ? input.from : null, to: input.to && DATE.test(input.to) ? input.to : null };
  const found = sortDocs(filterDocs(docs, filter));
  const today = localDate(new Date(), store.timezone());
  const totals = totalsByStatus(found);
  const sum = found.reduce((n, d) => n + (d.amountCents ?? 0), 0);
  return {
    count: found.length, total_amount: formatMoney(sum),
    by_status: Object.fromEntries((Object.keys(totals) as DocStatus[]).filter((s) => totals[s].count).map((s) => [STATUS_LABEL[s], { count: totals[s].count, total: formatMoney(totals[s].cents) }])),
    ...(found.some((d) => !d.status) ? { stored_only: found.filter((d) => !d.status).length } : {}),
    documents: found.slice(0, 25).map((d) => row(d, folders, today)),
    ...(found.length > 25 ? { note: `Mostrando 25 de ${found.length}. Peça à pessoa para filtrar mais.` } : {}),
  };
}

export type UpdateInput = {
  ids: string[]; status?: DocStatus | null; folder?: string | null; title?: string; issuer?: string | null; beneficiary?: string | null;
  docDate?: string | null; amountReais?: number | null; dueOn?: string | null;
};

export async function updateDocuments(store: DataStore, input: UpdateInput) {
  const [docs, folders] = await Promise.all([store.listDocuments(), store.listDocFolders()]);
  const mine = new Set(docs.map((d) => d.id));
  const ids = [...new Set(input.ids)].filter((id) => mine.has(id));
  if (!ids.length) return { error: "Nenhum desses documentos foi encontrado. Use find_documents para pegar os ids." };
  if (input.title !== undefined && ids.length > 1) return { error: "Mudar o nome só vale para um documento por vez." };
  const patch: Parameters<typeof changeDocument>[2] = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.folder !== undefined) {
    if (input.folder === null || plain(input.folder) === "sem pasta") patch.folderId = null;
    else {
      const f = matchFolder(folders, input.folder);
      if (!f) return { error: `Não existe pasta "${input.folder}". Pastas: ${folders.map((x) => x.name).join(", ") || "nenhuma"}. Crie com set_doc_folder.` };
      patch.folderId = f.id;
    }
  }
  if (input.title !== undefined) patch.title = input.title.trim().slice(0, 120);
  if (input.issuer !== undefined) patch.issuer = input.issuer?.trim().slice(0, 120) || null;
  if (input.beneficiary !== undefined) patch.beneficiary = input.beneficiary?.trim().slice(0, 80) || null;
  if (input.docDate !== undefined) patch.docDate = input.docDate && DATE.test(input.docDate) ? input.docDate : null;
  if (input.amountReais !== undefined) patch.amountCents = input.amountReais === null ? null : Math.round(input.amountReais * 100);
  if (input.dueOn !== undefined) patch.dueOn = input.dueOn && DATE.test(input.dueOn) ? input.dueOn : null;
  if (!Object.keys(patch).length) return { error: "Nada para mudar." };
  const updated: Doc[] = [];
  for (const id of ids) { const d = await changeDocument(store, id, patch); if (d) updated.push(d); }
  return {
    ok: true, updated: updated.length, titles: updated.slice(0, 10).map((d) => d.title),
    ...(input.status !== undefined ? { new_status: input.status ? STATUS_LABEL[input.status] : NO_STATUS_LABEL, total: formatMoney(updated.reduce((n, d) => n + (d.amountCents ?? 0), 0)) } : {}),
    ...(updated.length > 10 ? { note: "Mostrando 10 títulos." } : {}),
  };
}

// Documentos que o assistente vai mandar de volta: confere que são da pessoa e respeita o limite por mensagem
export async function pickForSending(store: DataStore, ids: string[]) {
  const docs = await store.listDocuments();
  const wanted = [...new Set(ids)].map((id) => docs.find((d) => d.id === id)).filter((d): d is Doc => !!d);
  return { send: wanted.slice(0, MAX_SEND), skipped: Math.max(0, wanted.length - MAX_SEND), missing: new Set(ids).size - wanted.length };
}

