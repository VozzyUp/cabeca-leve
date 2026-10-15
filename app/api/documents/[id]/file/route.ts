import { z } from "zod";
import { getStore } from "@/lib/data";

// GET /api/documents/<id>/file[?download=1]: devolve o arquivo ORIGINAL, só para o dono (a sessão decide quem é).
// O bucket é privado: este é o único caminho até o arquivo.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response("Não encontrado", { status: 404 });
  const file = await (await getStore()).readDocumentFile(id.data);
  if (!file) return new Response("Não encontrado", { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const ascii = file.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(file.bytes), { headers: {
    "content-type": file.mimeType,
    "content-length": String(file.bytes.length),
    "content-disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  } });
}
