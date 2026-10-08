import { z } from "zod";
import { getStore } from "@/lib/data";
import { rrule } from "@/lib/validation";

const Body = z.object({
  status: z.enum(["active", "done", "canceled"]).optional(),
  lastFiredAt: z.iso.datetime().optional(),
  nextFireAt: z.iso.datetime().optional(),
  title: z.string().trim().min(1).max(300).optional(),
  recurrenceRule: rrule.nullable().optional(),
});

// PATCH /api/reminders/{id}: concluir, reabrir, mudar, registrar que o aviso tocou
export async function PATCH(request: Request, ctx: RouteContext<"/api/reminders/[id]">) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const reminder = await (await getStore()).updateReminder(id, parsed.data);
  if (!reminder) return Response.json({ error: "Lembrete não encontrado" }, { status: 404 });
  return Response.json({ reminder });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/reminders/[id]">) {
  const { id } = await ctx.params;
  const ok = await (await getStore()).deleteReminder(id);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Lembrete não encontrado" }, { status: 404 });
}
