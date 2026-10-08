import { z } from "zod";
import { getStore } from "@/lib/data";
import { localDate } from "@/lib/time";
import { rrule } from "@/lib/validation";

export async function GET() {
  const store = await getStore();
  return Response.json({ tasks: await store.listTasks(), today: localDate(new Date(), store.timezone()) });
}

const Body = z.object({
  title: z.string().trim().min(1, "Dê um nome à tarefa").max(300),
  dueOn: z.iso.date().nullable(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  notes: z.string().max(5000).nullable().optional(),
  recurrenceRule: rrule.nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  if (parsed.data.recurrenceRule && !parsed.data.dueOn) return Response.json({ error: "Tarefa que se repete precisa de um prazo" }, { status: 400 });
  return Response.json({ task: await (await getStore()).createTask(parsed.data) }, { status: 201 });
}
