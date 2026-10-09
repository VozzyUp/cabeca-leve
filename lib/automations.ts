import { agentEnabled, writeReview } from "@/lib/assistant/agent";
import { storeForUser } from "@/lib/data";
import type { AutomationSource } from "@/lib/data/store";
import { nextAutomationRun } from "@/lib/domain/automation";
import { buildReviewContext, type ReviewData } from "@/lib/domain/review";
import { deliverReview } from "@/lib/deliveries";
import { getAdmin } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";

// Revisões agendadas: a varredura de cada minuto chama isto. Cada execução reserva antes uma linha em
// automation_runs (única por revisão e horário): se duas varreduras rodarem juntas, só uma gera o texto.
// O próximo horário já é gravado antes de gerar, então uma falha nunca faz a mesma revisão rodar de novo.

const MAX_LATE_MS = 3 * 3_600_000;  // mais atrasada que isso (app fora do ar) pula: resumo da manhã às 22h não ajuda
const PER_SWEEP = 5;

type Outcome = "delivered" | "empty" | "failed" | "skipped";

async function finishRun(automationId: string, scheduledFor: string, status: Outcome, error: string | null = null) {
  await getAdmin().from("automation_runs").update({ status, error, finished_at: new Date().toISOString() }).eq("automation_id", automationId).eq("scheduled_for", scheduledFor);
}

export async function runDueAutomations(now = new Date()): Promise<Record<Outcome, number>> {
  const result: Record<Outcome, number> = { delivered: 0, empty: 0, failed: 0, skipped: 0 };
  const db = getAdmin();
  const { data } = await db.from("automations")
    .select("id, user_id, title, instruction, sources, schedule, weekdays, run_time, run_on, timezone, lookback_days, channel, next_run_at")
    .eq("active", true).lte("next_run_at", now.toISOString()).order("next_run_at").limit(PER_SWEEP);

  await Promise.all((data ?? []).map(async (a) => {
    const scheduledFor = a.next_run_at!;
    const { error: taken } = await db.from("automation_runs").insert({ user_id: a.user_id, automation_id: a.id, scheduled_for: scheduledFor, status: "pending" });
    if (taken) return;  // outra varredura já pegou esta execução
    const tz = a.timezone;
    const next = nextAutomationRun({ schedule: a.schedule as "daily" | "weekly" | "monthly" | "once", weekdays: a.weekdays, runOn: a.run_on, time: a.run_time.slice(0, 5) }, tz, now);
    await db.from("automations").update({ next_run_at: next?.toISOString() ?? null, ...(next ? {} : { active: false }) }).eq("id", a.id).eq("user_id", a.user_id);

    const done = async (status: Outcome, error: string | null = null) => { result[status]++; await finishRun(a.id, scheduledFor, status, error); };
    try {
      if (now.getTime() - new Date(scheduledFor).getTime() > MAX_LATE_MS) return await done("skipped", "atrasada demais");
      if (!agentEnabled()) return await done("skipped", "IA não configurada");
      const store = await storeForUser(a.user_id);
      const settings = await store.getSettings();
      if (settings.plan === "none") return await done("skipped", "sem plano");

      const sources = a.sources as AutomationSource[];
      const need = (s: AutomationSource) => sources.includes(s);
      const [tasks, projects, habits, habitLogs, goals, transactions, categories, budgets, notes] = await Promise.all([
        need("tasks") ? store.listTasks() : [], need("projects") ? store.listProjects() : [], need("habits") ? store.listHabits() : [], need("habits") ? store.listHabitLogs() : [],
        need("goals") ? store.listGoals() : [], need("finance") ? store.listTransactions() : [], need("finance") ? store.listCategories() : [],
        need("finance") ? store.listBudgets() : [], need("notes") ? store.listNotes() : [],
      ]);
      const data: ReviewData = { tasks, projects, habits, habitLogs, goals, transactions, categories, budgets, notes };
      const context = buildReviewContext(sources, data, { now, tz, lookbackDays: a.lookback_days });
      if (!context) return await done("empty");  // nada a dizer: não gasta IA nem incomoda

      const text = await writeReview(store, { title: a.title, prompt: a.instruction, name: settings.name, tone: settings.tone, today: localDate(now, tz), context });
      const notes_ = await deliverReview(a.user_id, a.id, scheduledFor, a.channel as "push" | "whatsapp" | "email", { title: a.title, text });
      await done("delivered", notes_.length ? notes_.join("; ") : null);
    } catch (error) {
      console.error("revisão agendada falhou", a.id, (error as Error).message);
      await done("failed", (error as Error).message.slice(0, 500));
      await db.from("notices").insert({ user_id: a.user_id, kind: "automation", title: `${a.title}: não deu para montar`, body: "A revisão não saiu desta vez. Ela tenta de novo no próximo horário.", href: "/automacoes" });
    }
  }));
  return result;
}
