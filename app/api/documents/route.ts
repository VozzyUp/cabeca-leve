import { getStore } from "@/lib/data";
import { MAX_DOCUMENT_BYTES } from "@/lib/data/store";
import { DocumentError, prepareFile, saveDocument } from "@/lib/documents";
import { readDocument } from "@/lib/documents-ai";
import { localDate } from "@/lib/time";

export const maxDuration = 60;  // a leitura da IA pode levar alguns segundos

// POST /api/documents (multipart): file, folderId (opcional), storeOnly ("1" = só guardar, sem reembolso).
// Guarda o arquivo no Storage privado, deixa a IA preencher os dados e devolve o documento.
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_DOCUMENT_BYTES + 100_000) return Response.json({ error: "Arquivo grande demais (até 25 MB)." }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "Pedido inválido" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Escolha um arquivo." }, { status: 400 });
  const folderId = String(form.get("folderId") ?? "") || null;
  const storeOnly = form.get("storeOnly") === "1";

  const store = await getStore();
  try {
    const prepared = await prepareFile(Buffer.from(await file.arrayBuffer()), file.type, file.name);
    const folders = await store.listDocFolders();
    if (folderId && !folders.some((f) => f.id === folderId)) return Response.json({ error: "Essa pasta não existe mais." }, { status: 400 });
    const read = await readDocument(store, prepared);
    const today = localDate(new Date(), store.timezone());
    // data no futuro ou absurda é leitura errada: melhor sem data do que com a data errada
    const docDate = read?.docDate && read.docDate <= today && read.docDate >= "2000-01-01" ? read.docDate : null;
    const doc = await saveDocument(store, prepared, {
      folderId, title: read?.title ?? prepared.fileName.replace(/\.[A-Za-z0-9]{2,5}$/, ""), issuer: read?.issuer, category: read?.category,
      docDate, amountCents: read?.amountCents, status: storeOnly || read?.reimbursable === false ? null : "pending",
    }, "web");
    return Response.json({ document: doc, read: !!read });
  } catch (error) {
    if (error instanceof DocumentError) return Response.json({ error: error.message }, { status: error.code === "quota" ? 409 : error.code === "size" ? 413 : error.code === "type" ? 415 : 400 });
    throw error;
  }
}
