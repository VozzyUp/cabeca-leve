import { z } from "zod";
import { getStore } from "@/lib/data";

const Day = z.iso.date();

async function set(ctx: RouteContext<"/api/habits/[id]/logs/[day]">, done: boolean) {
  const { id, day } = await ctx.params;
  if (!Day.safeParse(day).success) return Response.json({ error: "Data inválida" }, { status: 400 });
  const ok = await (await getStore()).setHabitDone(id, day, done);
  if (!ok) return Response.json({ error: "Hábito não encontrado" }, { status: 404 });
  return Response.json({ ok: true });
}

// PUT marca o dia como feito (idempotente); DELETE desmarca
export async function PUT(_r: Request, ctx: RouteContext<"/api/habits/[id]/logs/[day]">) { return set(ctx, true); }
export async function DELETE(_r: Request, ctx: RouteContext<"/api/habits/[id]/logs/[day]">) { return set(ctx, false); }
