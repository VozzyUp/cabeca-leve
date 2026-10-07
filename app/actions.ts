"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/data";
import type { Settings } from "@/lib/data/types";

// Ações de servidor das telas do M3 e M4. Cada uma valida a entrada, grava pelo DataStore
// e revalida a tela. No /replica-backend, todas passam a checar a sessão do usuário.

const uuid = z.uuid();
const day = z.iso.date();

export async function setRecurrenceActive(id: string, active: boolean) {
  await getStore().setRecurrenceActive(uuid.parse(id), active);
  revalidatePath("/dinheiro/fixos");
}

export async function setMilestoneDone(projectId: string, milestoneId: string, done: boolean) {
  await getStore().setMilestoneDone(uuid.parse(projectId), uuid.parse(milestoneId), done);
  revalidatePath("/projetos");
}

export async function addGoalProgress(id: string, delta: number) {
  await getStore().addGoalProgress(uuid.parse(id), z.number().finite().parse(delta));
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
  const note = await getStore().createNote(parsed);
  revalidatePath("/notas");
  return note;
}

export async function updateNote(id: string, patch: { title?: string; body?: string; pinned?: boolean }) {
  const parsed = z.object({ title: z.string().trim().max(120).optional(), body: z.string().max(20_000).optional(), pinned: z.boolean().optional() }).parse(patch);
  await getStore().updateNote(uuid.parse(id), parsed);
  revalidatePath("/notas");
}

export async function setAutomationActive(id: string, active: boolean) {
  await getStore().setAutomationActive(uuid.parse(id), active);
  revalidatePath("/automacoes");
}

export async function markNoticesRead(ids: string[] | "all") {
  await getStore().markNoticesRead(ids === "all" ? "all" : z.array(uuid).parse(ids));
  revalidatePath("/avisos");
}

export async function saveFocusSession(input: { title: string; minutes: number; startedAt: string; finishedAt: string | null }) {
  const parsed = z.object({
    title: z.string().trim().min(1).max(200), minutes: z.number().int().min(1).max(240),
    startedAt: z.iso.datetime(), finishedAt: z.iso.datetime().nullable(),
  }).parse(input);
  await getStore().saveFocusSession(parsed);
  revalidatePath("/foco");
}

export async function setWorkoutDone(workoutId: string, onDay: string, done: boolean) {
  await getStore().setWorkoutDone(uuid.parse(workoutId), day.parse(onDay), done);
  revalidatePath("/saude", "layout");
}

export async function setMealDone(mealId: string, onDay: string, done: boolean) {
  await getStore().setMealDone(uuid.parse(mealId), day.parse(onDay), done);
  revalidatePath("/saude", "layout");
}

export async function addMeasurement(input: { day: string; weightKg: number | null; waistCm: number | null; hipCm: number | null }) {
  const n = (min: number, max: number) => z.number().min(min).max(max).nullable();
  const parsed = z.object({ day, weightKg: n(20, 400), waistCm: n(30, 250), hipCm: n(30, 250) }).parse(input);
  if (parsed.weightKg === null && parsed.waistCm === null && parsed.hipCm === null) throw new Error("Medida vazia");
  await getStore().addMeasurement(parsed);
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
  const s = await getStore().updateSettings(parsed);
  revalidatePath("/", "layout");
  return s;
}

export async function setCalendarConnected(source: "google" | "outlook", connected: boolean) {
  const store = getStore();
  const { calendars } = await store.getSettings();
  await store.updateSettings({ calendars: { ...calendars, [z.enum(["google", "outlook"]).parse(source)]: connected } });
  revalidatePath("/", "layout");
}

export async function setHabitDay(habitId: string, onDay: string, done: boolean) {
  const parsed = day.parse(onDay);
  if (parsed > new Date().toISOString().slice(0, 10) && done) throw new Error("Dia no futuro");
  await getStore().setHabitDone(uuid.parse(habitId), parsed, done);
  revalidatePath("/habitos", "layout");
}
