import { z } from "zod";
import { getStore } from "@/lib/data";

const Body = z.object({
  status: z.enum(["active", "done", "canceled"]).optional(),
  lastFiredAt: z.iso.datetime().optional(),
  title: z.string().trim().min(1).max(300).optional(),
});

// PATCH /api/reminders/{id}: concluir, reabrir, registrar que o aviso tocou
export async function PATCH(request: Request, ctx: RouteContext<"/api/reminders/[id]">) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const reminder = await getStore().updateReminder(id, parsed.data);
  if (!reminder) return Response.json({ error: "Lembrete não encontrado" }, { status: 404 });
  return Response.json({ reminder });
}
