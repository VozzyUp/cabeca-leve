import { z } from "zod";
import { getStore } from "@/lib/data";
import { buildCsv, buildPdf, exportName, ExportError, MAX_EXPORT_DOCS } from "@/lib/document-export";
import { localDate } from "@/lib/time";

export const maxDuration = 60;  // juntar muitas fotos e PDFs leva alguns segundos

const body = z.object({ ids: z.array(z.uuid()).min(1).max(MAX_EXPORT_DOCS), format: z.enum(["pdf", "csv"]) });

// POST /api/documents/export { ids, format }: um PDF único com a capa e todos os documentos, ou a planilha.
// A ordem é a dos ids; documentos que não são da pessoa simplesmente não entram.
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: `Escolha de 1 a ${MAX_EXPORT_DOCS} documentos.` }, { status: 400 });
  const store = await getStore();
  const [all, folders, settings] = await Promise.all([store.listDocuments(), store.listDocFolders(), store.getSettings()]);
  const byId = new Map(all.map((d) => [d.id, d]));
  const docs = [...new Set(parsed.data.ids)].map((id) => byId.get(id)).filter((d) => !!d);
  if (!docs.length) return Response.json({ error: "Nenhum desses documentos foi encontrado." }, { status: 404 });
  const today = localDate(new Date(), store.timezone());
  try {
    const bytes = parsed.data.format === "pdf" ? await buildPdf(store, docs, folders, settings.name) : Buffer.from(buildCsv(docs, folders), "utf8");
    return new Response(new Uint8Array(bytes), { headers: {
      "content-type": parsed.data.format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportName(parsed.data.format, today)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof ExportError) return Response.json({ error: error.message }, { status: 413 });
    throw error;
  }
}
