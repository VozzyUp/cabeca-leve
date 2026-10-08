import { deliverBriefings, deliverDueReminders } from "@/lib/deliveries";
import { verifyQStash } from "@/lib/queue";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Varredura de cada minuto: lembretes vencidos e resumo da manhã. Chamada por um agendamento
// do QStash (assinado) ou pelo Vercel Cron (Authorization: Bearer CRON_SECRET).
async function handle(request: Request) {
  const raw = request.method === "POST" ? await request.text() : "";
  const bearer = request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}` && !!process.env.CRON_SECRET;
  if (!bearer && !(await verifyQStash(request, raw))) return new Response("forbidden", { status: 401 });
  if (!isSupabaseConfigured()) return Response.json({ skipped: "modo de demonstração" });
  const now = new Date();
  const [reminders, briefings] = await Promise.all([deliverDueReminders(now), deliverBriefings(now)]);
  return Response.json({ reminders, briefings });
}

export const GET = handle;
export const POST = handle;
