import { z } from "zod";
import { getStore } from "@/lib/data";
import { rrule } from "@/lib/validation";

const Body = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  dueOn: z.iso.date().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  notes: z.string().max(5000).nullable().optional(),
  recurrenceRule: rrule.nullable().optional(),
});

// PATCH: editar ou concluir (concluir uma recorrente cria a próxima)
export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const task = await (await getStore()).updateTask(id, parsed.data);
  if (!task) return Response.json({ error: "Tarefa não encontrada" }, { status: 404 });
  return Response.json({ task });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  const ok = await (await getStore()).deleteTask(id);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Tarefa não encontrada" }, { status: 404 });
}
