import { getStore } from "@/lib/data";

// POST /api/actions/{id}/undo: desfaz uma ação do assistente
export async function POST(_request: Request, ctx: RouteContext<"/api/actions/[id]/undo">) {
  const { id } = await ctx.params;
  const result = await (await getStore()).undoAction(id);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409;
    const error = result.reason === "not_found" ? "Ação não encontrada" : "Essa ação já foi desfeita";
    return Response.json({ error }, { status });
  }
  return Response.json({ ok: true });
}
