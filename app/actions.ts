"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { billingEnabled, cancelSubscription, createCheckout } from "@/lib/billing/asaas";
import { z } from "zod";
import { getStore } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { startLink } from "@/lib/whatsapp/link";
import type { Settings } from "@/lib/data/types";

// Ações de servidor das telas do M3 e M4. Cada uma valida a entrada, grava pelo DataStore
// e revalida a tela. No /replica-backend, todas passam a checar a sessão do usuário.

const uuid = z.uuid();
const day = z.iso.date();

export async function setRecurrenceActive(id: string, active: boolean) {
  await (await getStore()).setRecurrenceActive(uuid.parse(id), active);
  revalidatePath("/dinheiro/fixos");
}

export async function setMilestoneDone(projectId: string, milestoneId: string, done: boolean) {
  await (await getStore()).setMilestoneDone(uuid.parse(projectId), uuid.parse(milestoneId), done);
  revalidatePath("/projetos");
}

export async function addGoalProgress(id: string, delta: number) {
  await (await getStore()).addGoalProgress(uuid.parse(id), z.number().finite().parse(delta));
  revalidatePath("/metas");
}

const noteInput = z.object({
  title: z.string().trim().max(120),
  body: z.string().trim().max(20_000),
  notebook: z.string().trim().min(1).max(40),
  kind: z.enum(["note", "journal"]),
});

export async function createNote(input: z.input<typeof noteInput>) {
  const parsed = noteInput.parse(input);
  if (!parsed.title && !parsed.body) throw new Error("Nota vazia");
  const note = await (await getStore()).createNote(parsed);
  revalidatePath("/notas");
  return note;
}

export async function updateNote(id: string, patch: { title?: string; body?: string; pinned?: boolean }) {
  const parsed = z.object({ title: z.string().trim().max(120).optional(), body: z.string().max(20_000).optional(), pinned: z.boolean().optional() }).parse(patch);
  await (await getStore()).updateNote(uuid.parse(id), parsed);
  revalidatePath("/notas");
}

export async function setAutomationActive(id: string, active: boolean) {
  await (await getStore()).setAutomationActive(uuid.parse(id), active);
  revalidatePath("/automacoes");
}

export async function markNoticesRead(ids: string[] | "all") {
  await (await getStore()).markNoticesRead(ids === "all" ? "all" : z.array(uuid).parse(ids));
  revalidatePath("/avisos");
}

export async function saveFocusSession(input: { title: string; minutes: number; startedAt: string; finishedAt: string | null }) {
  const parsed = z.object({
    title: z.string().trim().min(1).max(200), minutes: z.number().int().min(1).max(240),
    startedAt: z.iso.datetime(), finishedAt: z.iso.datetime().nullable(),
  }).parse(input);
  await (await getStore()).saveFocusSession(parsed);
  revalidatePath("/foco");
}

export async function setWorkoutDone(workoutId: string, onDay: string, done: boolean) {
  await (await getStore()).setWorkoutDone(uuid.parse(workoutId), day.parse(onDay), done);
  revalidatePath("/saude", "layout");
}

export async function setMealDone(mealId: string, onDay: string, done: boolean) {
  await (await getStore()).setMealDone(uuid.parse(mealId), day.parse(onDay), done);
  revalidatePath("/saude", "layout");
}

export async function addMeasurement(input: { day: string; weightKg: number | null; waistCm: number | null; hipCm: number | null }) {
  const n = (min: number, max: number) => z.number().min(min).max(max).nullable();
  const parsed = z.object({ day, weightKg: n(20, 400), waistCm: n(30, 250), hipCm: n(30, 250) }).parse(input);
  if (parsed.weightKg === null && parsed.waistCm === null && parsed.hipCm === null) throw new Error("Medida vazia");
  await (await getStore()).addMeasurement(parsed);
  revalidatePath("/saude", "layout");
}

const settingsPatch = z.object({
  name: z.string().trim().min(1).max(80),
  tone: z.enum(["direct", "warm", "playful"]),
  answerLength: z.enum(["short", "detailed"]),
  voice: z.enum(["female", "male"]),
  memoryEnabled: z.boolean(),
  theme: z.enum(["dark", "light", "system"]),
  briefingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  channels: z.object({ whatsapp: z.string().regex(/^\+\d{10,15}$/).nullable(), telegram: z.boolean(), email: z.boolean(), push: z.boolean() }),
  calendars: z.object({ google: z.boolean(), outlook: z.boolean() }),
}).partial();

export async function updateSettings(patch: Partial<Settings>) {
  const parsed = settingsPatch.parse(patch);
  const s = await (await getStore()).updateSettings(parsed);
  revalidatePath("/", "layout");
  return s;
}

export async function setCalendarConnected(source: "google" | "outlook", connected: boolean) {
  const store = await getStore();
  const { calendars } = await store.getSettings();
  await store.updateSettings({ calendars: { ...calendars, [z.enum(["google", "outlook"]).parse(source)]: connected } });
  revalidatePath("/", "layout");
}

export async function setHabitDay(habitId: string, onDay: string, done: boolean) {
  const parsed = day.parse(onDay);
  if (parsed > new Date().toISOString().slice(0, 10) && done) throw new Error("Dia no futuro");
  await (await getStore()).setHabitDone(uuid.parse(habitId), parsed, done);
  revalidatePath("/habitos", "layout");
}

// Portabilidade (LGPD): tudo do usuário num JSON
export async function exportData() {
  const s = await getStore();
  const [settings, tasks, reminders, habits, habitLogs, transactions, categories, accounts, cards, recurrences, installments,
    projects, goals, notes, automations, notices, focusSessions, workouts, workoutLogs, meals, mealLogs, measurements, messages] = await Promise.all([
    s.getSettings(), s.listTasks(), s.listReminders(), s.listHabits(), s.listHabitLogs(), s.listTransactions(), s.listCategories(),
    s.listAccounts(), s.listCards(), s.listRecurrences(), s.listInstallments(), s.listProjects(), s.listGoals(), s.listNotes(),
    s.listAutomations(), s.listNotices(), s.listFocusSessions(), s.listWorkouts(), s.listWorkoutLogs(), s.listMeals(), s.listMealLogs(),
    s.listMeasurements(), s.listMessages(),
  ]);
  return JSON.stringify({
    exportedAt: new Date().toISOString(), settings, tasks, reminders, habits, habitLogs, transactions, categories, accounts, cards,
    recurrences, installments, projects, goals, notes, automations, notices, focusSessions, workouts, workoutLogs, meals, mealLogs,
    measurements, messages,
  }, null, 2);
}

export async function deleteAccount(confirmation: string) {
  if (confirmation.trim().toUpperCase() !== "EXCLUIR") throw new Error("Confirmação errada");
  await (await getStore()).deleteAllData();
  revalidatePath("/", "layout");
  return { ok: true as const };
}

// Vincular o WhatsApp: com Supabase, gera o código que a pessoa manda do próprio celular;
// no modo de demonstração, só guarda o número.
export async function linkWhatsApp(number: string) {
  const n = z.string().regex(/^\+\d{12,13}$/).parse(number);
  if (!isSupabaseConfigured()) {
    const store = await getStore();
    const { channels } = await store.getSettings();
    await store.updateSettings({ channels: { ...channels, whatsapp: n } });
    revalidatePath("/ajustes");
    return null;
  }
  const user = await currentUser();
  if (!user) throw new Error("Sessão expirada");
  const result = await startLink(user.id, n);
  revalidatePath("/ajustes");
  return result;
}

// Abre a página de pagamento da Asaas para o plano escolhido
export async function startCheckout(plan: "monthly" | "yearly") {
  const p = z.enum(["monthly", "yearly"]).parse(plan);
  const user = await currentUser();
  if (!user) redirect(`/entrar?modo=criar&plano=${p}`);
  if (!billingEnabled()) throw new Error("Cobrança não configurada");
  const settings = await (await getStore()).getSettings();
  redirect(await createCheckout(user.id, p, settings.trialEndsOn));
}

// Cancelar em um toque: para de cobrar e o acesso vale até o fim do período pago
export async function cancelPlan() {
  const user = await currentUser();
  if (!user) throw new Error("Sessão expirada");
  await cancelSubscription(user.id);
  revalidatePath("/", "layout");
}
