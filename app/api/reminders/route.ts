import { z } from "zod";
import { getStore } from "@/lib/data";

export async function GET() {
  return Response.json({ reminders: await getStore().listReminders(), timezone: getStore().timezone() });
}

const Body = z.object({
  title: z.string().trim().min(1).max(300),
  nextFireAt: z.iso.datetime(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  return Response.json({ reminder: await getStore().createReminder(parsed.data) }, { status: 201 });
}
