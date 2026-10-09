import { runDueAutomations } from "@/lib/automations";
import { deliverBriefings, deliverDueReminders } from "@/lib/deliveries";
import { verifyQStash } from "@/lib/queue";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getAdmin } from "@/lib/supabase/server";

// Varredura de cada minuto: lembretes vencidos, resumo da manhã e revisões agendadas. Chamada por um agendamento
// do QStash (assinado) ou pelo Vercel Cron (Authorization: Bearer CRON_SECRET).
async function handle(request: Request) {
  const raw = request.method === "POST" ? await request.text() : "";
  const bearer = request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}` && !!process.env.CRON_SECRET;
  if (!bearer && !(await verifyQStash(request, raw))) return new Response("forbidden", { status: 401 });
  if (!isSupabaseConfigured()) return Response.json({ skipped: "modo de demonstração" });
  const now = new Date();
  const [reminders, briefings, automations] = await Promise.all([deliverDueReminders(now), deliverBriefings(now), runDueAutomations(now)]);
  // uma vez por hora: troca por texto as fotos de conversas de mais de 2 dias (não guarda comprovantes para sempre)
  let photosPurged = 0;
  if (now.getUTCMinutes() === 11) {
    const { data } = await getAdmin().rpc("purge_old_message_images", { p_days: 2 });
    photosPurged = data ?? 0;
  }
  return Response.json({ reminders, briefings, automations, photosPurged });
}

export const GET = handle;
export const POST = handle;
