import { z } from "zod";
import { getStore } from "@/lib/data";
import { rrule } from "@/lib/validation";

export async function GET() {
  const store = await getStore();
  return Response.json({ reminders: await store.listReminders(), timezone: store.timezone() });
}

const Body = z.object({
  title: z.string().trim().min(1, "Escreva do que lembrar").max(300),
  nextFireAt: z.iso.datetime(),
  recurrenceRule: rrule.nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  if (new Date(parsed.data.nextFireAt).getTime() < Date.now() - 60_000) return Response.json({ error: "Esse horário já passou" }, { status: 400 });
  return Response.json({ reminder: await (await getStore()).createReminder(parsed.data) }, { status: 201 });
}
