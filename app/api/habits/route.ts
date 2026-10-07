import { z } from "zod";
import { getStore } from "@/lib/data";
import { habitStats } from "@/lib/domain/habits";
import { localDate } from "@/lib/time";

// Hábitos com estatísticas calculadas no servidor (sequência, recorde, últimos 7 dias)
export async function GET() {
  const store = getStore();
  const today = localDate(new Date(), store.timezone());
  const [habits, logs] = await Promise.all([store.listHabits(), store.listHabitLogs()]);
  return Response.json({ today, habits: habits.map((h) => ({ ...h, stats: habitStats(h, logs, today) })) });
}

const Body = z.object({
  name: z.string().trim().min(1, "Dê um nome ao hábito").max(120),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).default([0, 1, 2, 3, 4, 5, 6]),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  return Response.json({ habit: await getStore().createHabit(parsed.data) }, { status: 201 });
}
