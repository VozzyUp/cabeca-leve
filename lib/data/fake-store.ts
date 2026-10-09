import fs from "node:fs";
import path from "node:path";
import { addDays, DEFAULT_TZ, localDate, zonedToUtc } from "@/lib/time";
import { sameFact } from "@/lib/domain/memory";
import { MAX_MEMORIES, type DataStore } from "./store";
import { nextDate, nextFireAt, reopenFireAt } from "@/lib/domain/recurrence";
import { seedFinance, seedHealth, seedOrganization, seedSettings } from "./seed-extra";

// demonstração: um turno por vez no mesmo processo
let turnQueue: Promise<unknown> = Promise.resolve();
import type {
  Account, ActionRecord, Automation, BodyMeasurement, CalendarEvent, Category, ChatMessage, CreditCard, FocusSession, Goal,
  Habit, HabitLog, InstallmentPurchase, Meal, MealLog, Note, Notice, Project, Recurrence, Reminder, Settings, Task,
  Transaction, Workout, WorkoutLog,
  Budget, Memory,
} from "./types";

// Banco provisório com dados de exemplo, só até o /replica-backend ligar o Supabase.
// Grava num arquivo (.data/fake-db.json) em vez de só na memória: no modo de
// desenvolvimento, a primeira chamada a uma rota recém-compilada roda em outro
// contexto, e um estado só em memória perdia essa alteração.

type State = {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  reminders: Reminder[];
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  actions: ActionRecord[];
  messages: Array<ChatMessage & { content?: unknown; visible?: boolean; system?: boolean }>;
  cards: CreditCard[];
  recurrences: Recurrence[];
  installments: InstallmentPurchase[];
  projects: Project[];
  goals: Goal[];
  notes: Note[];
  automations: Automation[];
  notices: Notice[];
  budgets?: Budget[];
  events: CalendarEvent[];
  focusSessions: FocusSession[];
  workouts: Workout[];
  workoutLogs: WorkoutLog[];
  meals: Meal[];
  mealLogs: MealLog[];
  measurements: BodyMeasurement[];
  // fichas e planos criados pelo chat: quais itens são de cada um e qual vale agora (os de exemplo não têm grupo)
  plans?: Array<{ id: string; kind: "workout" | "meal"; active: boolean; ids: string[] }>;
  memories?: Memory[];
  settings: Settings;
};

const id = () => crypto.randomUUID();

// tira da vista as fichas e planos que um novo substituiu (continuam guardados, para o desfazer)
function hidden(s: State) {
  const off = new Set((s.plans ?? []).filter((p) => !p.active).flatMap((p) => p.ids));
  return { workouts: s.workouts.filter((w) => !off.has(w.id)), meals: s.meals.filter((m) => !off.has(m.id)) };
}

const CATEGORY_NAMES: Array<[string, Category["kind"]]> = [
  ["Alimentação", "expense"], ["Mercado", "expense"], ["Transporte", "expense"], ["Moradia", "expense"],
  ["Contas da casa", "expense"], ["Saúde", "expense"], ["Educação", "expense"], ["Lazer", "expense"],
  ["Compras", "expense"], ["Assinaturas", "expense"], ["Outros gastos", "expense"],
  ["Salário", "income"], ["Freelance", "income"], ["Outras entradas", "income"],
];

export function seedState(now = new Date(), tz = DEFAULT_TZ): State {
  const categories = CATEGORY_NAMES.map(([name, kind]) => ({ id: id(), name, kind }));
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;
  const today = localDate(now, tz);
  const account: Account = { id: id(), name: "Conta corrente", openingBalanceCents: 320000 };
  const tx = (daysAgo: number, type: Transaction["type"], cents: number, description: string, category: string,
    paymentMethod: Transaction["paymentMethod"]): Transaction => ({
    id: id(), type, amountCents: cents, occurredOn: addDays(today, -daysAgo), description,
    categoryId: cat(category), accountId: account.id, paymentMethod, source: "manual",
    createdAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  });
  const at = (days: number, hour: number) => {
    const [y, m, d] = addDays(today, days).split("-").map(Number);
    return zonedToUtc(y, m, d, hour, 0, tz).toISOString();
  };
  const reminder = (title: string, nextFireAt: string, status: Reminder["status"] = "active"): Reminder => ({
    id: id(), title, nextFireAt: status === "active" ? nextFireAt : null, recurrenceRule: null,
    channels: ["push"], status, lastFiredAt: null, createdAt: now.toISOString(),
  });
  const task = (title: string, dueIn: number | null, priority: Task["priority"], done = false): Task => ({
    id: id(), title, dueOn: dueIn === null ? null : addDays(today, dueIn), priority, notes: null, recurrenceRule: null,
    status: done ? "done" : "todo", completedAt: done ? now.toISOString() : null, createdAt: now.toISOString(),
  });
  const habit = (name: string, time: string | null, weekdays = [0, 1, 2, 3, 4, 5, 6]): Habit => ({
    id: id(), name, weekdays, time, active: true, createdAt: now.toISOString(),
  });
  const habits = [habit("Meditar 10 minutos", "07:30"), habit("Ler 20 páginas", "21:00"), habit("Academia", "18:30", [1, 3, 5])];
  // histórico: meditação quase todo dia, leitura às vezes
  const habitLogs: HabitLog[] = [];
  for (let d = 1; d <= 12; d++) {
    if (d !== 4) habitLogs.push({ habitId: habits[0].id, day: addDays(today, -d) });
    if (d % 2 === 0) habitLogs.push({ habitId: habits[1].id, day: addDays(today, -d) });
  }
  const recent = [
    tx(6, "income", 650000, "Salário", "Salário", "other"),
    tx(5, "expense", 18990, "Compra do mês", "Mercado", "debit"),
    tx(3, "expense", 4590, "Assinatura de música", "Assinaturas", "credit"),
    tx(2, "expense", 2350, "Corrida de aplicativo", "Transporte", "pix"),
    tx(1, "expense", 6200, "Jantar com amigos", "Lazer", "pix"),
  ];
  const finance = seedFinance({ today, now, tz, categories, accountId: account.id, skipSalaryMonth: recent[0].occurredOn.slice(0, 7) });
  for (const t of recent) if (t.paymentMethod === "credit") t.cardId = finance.cards[0].id;
  return {
    tasks: [
      task("Enviar o orçamento para o cliente", 0, "high"),
      task("Marcar consulta no dentista", 0, "medium"),
      task("Responder o e-mail da escola", -2, "medium"),
      task("Trocar o filtro do ar-condicionado", 3, "low"),
      task("Organizar as fotos do celular", null, "low"),
      task("Pagar o IPVA", -1, "high", true),
    ],
    habits,
    habitLogs,
    categories,
    accounts: [account],
    transactions: [...finance.transactions, ...recent],
    cards: finance.cards,
    recurrences: finance.recurrences,
    installments: finance.installments,
    ...seedOrganization({ today, now, tz }),
    ...seedHealth({ today }),
    settings: seedSettings({ today, tz }),
    reminders: [
      reminder("Pagar a conta de internet", at(1, 9)),
      reminder("Renovar a CNH", at(4, 10)),
      reminder("Levar o carro na revisão", at(-2, 8), "done"),
    ],
    actions: [],
    messages: [],
  };
}

const FILE = path.join(process.cwd(), ".data", "fake-db.json");

// Lê o arquivo a cada operação (o estado é pequeno) e cria com os exemplos na primeira vez
function load(): State {
  try {
    const s = JSON.parse(fs.readFileSync(FILE, "utf8")) as State;
    // arquivo criado antes das telas do M3: completa com os exemplos novos
    if (!s.settings) {
      const fresh = seedState();
      for (const k of Object.keys(fresh) as Array<keyof State>) if (!(k in s)) Object.assign(s, { [k]: fresh[k] });
    }
    return s;
  } catch {
    const s = seedState();
    save(s);
    return s;
  }
}

function save(s: State) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s));
  fs.renameSync(tmp, FILE);  // troca atômica: nunca fica um arquivo pela metade
}

// Lê, deixa a função alterar e grava
function mutate<T>(fn: (s: State) => T): T {
  const s = load();
  const result = fn(s);
  save(s);
  return result;
}

export function resetFakeState(s?: State) {
  save(s ?? seedState());
}

export const fakeStore: DataStore = {
  timezone: () => DEFAULT_TZ,

  async listReminders() {
    return load().reminders.sort((a, b) => (a.nextFireAt ?? "9").localeCompare(b.nextFireAt ?? "9"));
  },
  async createReminder({ title, nextFireAt: at, channels = ["push"], recurrenceRule = null }) {
    const r: Reminder = { id: id(), title, nextFireAt: at, recurrenceRule, channels, status: "active",
      lastFiredAt: null, createdAt: new Date().toISOString() };
    mutate((s) => s.reminders.push(r));
    return r;
  },
  async updateReminder(rid, patch) {
    return mutate((s) => {
      const r = s.reminders.find((x) => x.id === rid);
      if (!r) return null;
      Object.assign(r, patch);
      // concluir guarda a data do aviso; reabrir precisa de uma (como no banco)
      if (patch.status === "active" && patch.nextFireAt === undefined) r.nextFireAt = reopenFireAt(r.recurrenceRule, r.nextFireAt, DEFAULT_TZ, new Date());
      // avisou um recorrente: já fica marcado para a próxima vez
      if (patch.lastFiredAt && r.recurrenceRule && r.nextFireAt && r.status === "active") {
        r.nextFireAt = nextFireAt(r.recurrenceRule, r.nextFireAt, DEFAULT_TZ, new Date(patch.lastFiredAt)) ?? r.nextFireAt;
      }
      return r;
    });
  },
  async deleteReminder(rid) {
    return mutate((s) => {
      const before = s.reminders.length;
      s.reminders = s.reminders.filter((r) => r.id !== rid);
      return s.reminders.length < before;
    });
  },

  async listTasks() {
    return load().tasks;
  },
  async createTask({ title, dueOn, priority = "medium", notes = null, recurrenceRule = null }) {
    const t: Task = { id: id(), title, dueOn, priority, notes, recurrenceRule, status: "todo", completedAt: null, createdAt: new Date().toISOString() };
    mutate((s) => s.tasks.push(t));
    return t;
  },
  async updateTask(tid, patch) {
    return mutate((s) => {
      const t = s.tasks.find((x) => x.id === tid);
      if (!t) return null;
      const wasDone = t.status === "done";
      Object.assign(t, patch);
      if (patch.status) t.completedAt = patch.status === "done" ? (t.completedAt ?? new Date().toISOString()) : null;
      // concluiu uma recorrente: cria a próxima (uma vez só)
      if (patch.status === "done" && !wasDone && t.recurrenceRule && !s.tasks.some((x) => x.recurrenceSourceId === t.id)) {
        const base = t.dueOn ?? localDate(new Date(), DEFAULT_TZ);
        const due = nextDate(t.recurrenceRule, base, base);
        if (due) s.tasks.push({ ...t, id: id(), dueOn: due, status: "todo", completedAt: null, recurrenceSourceId: t.id, createdAt: new Date().toISOString() });
      }
      return t;
    });
  },
  async deleteTask(tid) {
    return mutate((s) => {
      const before = s.tasks.length;
      s.tasks = s.tasks.filter((t) => t.id !== tid);
      return s.tasks.length < before;
    });
  },
  async listHabits() {
    return load().habits.filter((h) => h.active);
  },
  async createHabit({ name, weekdays = [0, 1, 2, 3, 4, 5, 6], time = null }) {
    const h: Habit = { id: id(), name, weekdays, time, active: true, createdAt: new Date().toISOString() };
    mutate((s) => s.habits.push(h));
    return h;
  },
  async archiveHabit(hid) {
    return mutate((s) => {
      const h = s.habits.find((x) => x.id === hid);
      if (h) h.active = false;
      return !!h;
    });
  },
  async listHabitLogs() {
    return load().habitLogs;
  },
  async setHabitDone(habitId, day, done) {
    return mutate((s) => {
      if (!s.habits.some((h) => h.id === habitId)) return false;
      // um registro por hábito por dia (como a unique do banco)
      s.habitLogs = s.habitLogs.filter((l) => !(l.habitId === habitId && l.day === day));
      if (done) s.habitLogs.push({ habitId, day });
      return true;
    });
  },

  async listTransactions() {
    return load().transactions.sort((a, b) =>
      b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt));
  },
  async createTransaction(input) {
    const t: Transaction = { ...input, id: id(), createdAt: new Date().toISOString() };
    mutate((s) => s.transactions.push(t));
    return t;
  },
  async updateTransaction(tid, patch) {
    return mutate((s) => {
      const t = s.transactions.find((x) => x.id === tid);
      if (!t) return null;
      Object.assign(t, patch);
      return t;
    });
  },
  async deleteTransaction(tid) {
    return mutate((s) => {
      const before = s.transactions.length;
      s.transactions = s.transactions.filter((t) => t.id !== tid);
      return s.transactions.length < before;
    });
  },
  async listCategories() {
    return load().categories.filter((c) => !(c as { archived?: boolean }).archived);
  },
  async createCategory({ name, kind, parentId }) {
    return mutate((s) => {
      const parent = parentId ? s.categories.find((c) => c.id === parentId) : null;
      const c: Category = { id: id(), name, kind: parent?.kind ?? kind, parentId: parent?.id ?? null };
      s.categories.push(c);
      return c;
    });
  },
  async updateCategory(cid, { name }) {
    return mutate((s) => {
      const c = s.categories.find((x) => x.id === cid);
      if (c) c.name = name;
      return c ?? null;
    });
  },
  async archiveCategory(cid) {
    return mutate((s) => {
      let found = false;
      for (const c of s.categories) if (c.id === cid || c.parentId === cid) { Object.assign(c, { archived: true }); found = true; }
      return found;
    });
  },
  async listAccounts() {
    const s = load();
    return s.accounts.map((a) => ({
      ...a,
      balanceCents: a.openingBalanceCents + s.transactions
        .filter((t) => t.accountId === a.id && t.paymentMethod !== "credit")
        .reduce((sum, t) => sum + (t.type === "income" ? t.amountCents : -t.amountCents), 0),
    }));
  },

  async recordAiUsage() {},  // sem banco, sem painel de custo
  async recordAction(entity, entityId, replaced) {
    const a: ActionRecord = { id: id(), entity, entityId, operation: "create", undoneAt: null, ...(replaced?.length ? { replaced } : {}) };
    mutate((s) => s.actions.push(a));
    return a;
  },
  async undoAction(aid) {
    return mutate((s): { ok: true } | { ok: false; reason: "not_found" | "already_undone" } => {
      const a = s.actions.find((x) => x.id === aid);
      if (!a) return { ok: false, reason: "not_found" };
      if (a.undoneAt) return { ok: false, reason: "already_undone" };
      // desfazer uma criação = remover o item criado
      if (a.entity === "reminder") s.reminders = s.reminders.filter((r) => r.id !== a.entityId);
      else if (a.entity === "task") s.tasks = s.tasks.filter((t) => t.id !== a.entityId);
      else if (a.entity === "habit") {
        s.habits = s.habits.filter((h) => h.id !== a.entityId);
        s.habitLogs = s.habitLogs.filter((l) => l.habitId !== a.entityId);
      } else if (a.entity === "project") s.projects = s.projects.filter((p) => p.id !== a.entityId);
      else if (a.entity === "recurrence") s.recurrences = s.recurrences.filter((x) => x.id !== a.entityId);
      else if (a.entity === "goal") s.goals = s.goals.filter((g) => g.id !== a.entityId);
      else if (a.entity === "automation") s.automations = s.automations.filter((x) => x.id !== a.entityId);
      else if (a.entity === "workout_plan" || a.entity === "meal_plan") {
        const kind = a.entity === "workout_plan" ? "workout" : "meal";
        const plan = (s.plans ?? []).find((p) => p.id === a.entityId);
        if (plan) {
          const gone = new Set(plan.ids);
          if (kind === "workout") s.workouts = s.workouts.filter((w) => !gone.has(w.id)); else s.meals = s.meals.filter((m) => !gone.has(m.id));
          s.plans = (s.plans ?? []).filter((p) => p.id !== plan.id);
        }
        for (const p of s.plans ?? []) if (a.replaced?.includes(p.id)) p.active = true;
      } else s.transactions = s.transactions.filter((t) => t.id !== a.entityId);
      a.undoneAt = new Date().toISOString();
      for (const m of s.messages) for (const c of m.cards) if (c.actionId === aid) c.undone = true;
      return { ok: true };
    });
  },

  async listMessages() {
    return load().messages.filter((m) => m.visible !== false && !m.system)
      .map(({ id: mid, role, text, cards, createdAt }) => ({ id: mid, role, text, cards, createdAt }));
  },
  async appendMessage(msg) {
    const m = {
      id: id(), role: msg.role === "system" ? "user" as const : msg.role, system: msg.role === "system", text: msg.text, cards: msg.cards,
      content: msg.content ?? [{ type: "text", text: msg.text }], visible: msg.visible ?? true, createdAt: new Date().toISOString(),
    };
    mutate((s) => s.messages.push(m));
    return { id: m.id, role: m.role, text: m.text, cards: m.cards, createdAt: m.createdAt };
  },
  async openSupportTicket() { return null; },  // demonstração: sem time de suporte
  async listSupportTickets() { return []; },
  withTurn(fn) {
    const run = turnQueue.then(fn, fn);
    turnQueue = run.then(() => undefined, () => undefined);
    return run;
  },
  async countUserMessagesSince(iso) {
    return load().messages.filter((m) => m.role === "user" && !m.system && m.createdAt >= iso).length;
  },
  async listTodayTranscript() {
    const today = localDate(new Date(), DEFAULT_TZ);
    return load().messages.filter((m) => localDate(new Date(m.createdAt), DEFAULT_TZ) === today)
      .map((m) => ({ role: m.system ? "system" as const : m.role, content: m.content ?? [{ type: "text", text: m.text }] }));
  },
  async markCardsUndone(actionId) {
    mutate((s) => { for (const m of s.messages) for (const c of m.cards) if (c.actionId === actionId) c.undone = true; });
  },

  async listCards() {
    return load().cards;
  },
  async listRecurrences() {
    return load().recurrences.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  },
  async createRecurrence(input) {
    const r: Recurrence = { id: id(), kind: input.kind, description: input.description, amountCents: input.amountCents, dayOfMonth: input.dayOfMonth,
      categoryId: input.categoryId, paymentMethod: input.paymentMethod, active: true, createdOn: input.fromThisMonth ? `${localDate(new Date(), DEFAULT_TZ).slice(0, 7)}-01` : localDate(new Date(), DEFAULT_TZ) };
    mutate((s) => s.recurrences.push(r));
    return r;
  },
  async setRecurrenceActive(rid, active) {
    return mutate((s) => {
      const r = s.recurrences.find((x) => x.id === rid);
      if (r) r.active = active;
      return !!r;
    });
  },
  async listInstallments() {
    return load().installments;
  },

  async listProjects() {
    return load().projects;
  },
  async createProject(input) {
    const p: Project = {
      id: id(), name: input.name, description: input.description, dueOn: input.dueOn, status: "active",
      milestones: input.milestones.map((m) => ({ id: id(), title: m.title, done: false })),
    };
    mutate((s) => s.projects.push(p));
    return p;
  },
  async createGoal(input) {
    const g: Goal = { id: id(), title: input.title, unit: input.unit, targetValue: input.targetValue, currentValue: 0, startOn: localDate(new Date(), DEFAULT_TZ), dueOn: input.dueOn };
    mutate((s) => s.goals.push(g));
    return g;
  },
  async setMilestoneDone(projectId, milestoneId, done) {
    return mutate((s) => {
      const m = s.projects.find((p) => p.id === projectId)?.milestones.find((x) => x.id === milestoneId);
      if (m) m.done = done;
      return !!m;
    });
  },
  async listGoals() {
    return load().goals;
  },
  async addGoalProgress(gid, delta) {
    return mutate((s) => {
      const g = s.goals.find((x) => x.id === gid);
      if (!g) return null;
      g.currentValue = Math.max(0, g.currentValue + delta);
      return g;
    });
  },
  async listNotes() {
    return load().notes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  },
  async createNote(input) {
    const at = new Date().toISOString();
    const n: Note = { ...input, id: id(), pinned: false, createdAt: at, updatedAt: at };
    mutate((s) => s.notes.push(n));
    return n;
  },
  async updateNote(nid, patch) {
    return mutate((s) => {
      const n = s.notes.find((x) => x.id === nid);
      if (!n) return null;
      Object.assign(n, patch, { updatedAt: new Date().toISOString() });
      return n;
    });
  },
  async listAutomations() {
    return load().automations;
  },
  async createAutomation(input) {
    const a: Automation = {
      id: id(), title: input.title, prompt: input.prompt, schedule: input.schedule, weekdays: input.schedule === "daily" ? [0, 1, 2, 3, 4, 5, 6] : input.weekdays,
      runOn: input.runOn, time: input.time, channel: input.channel, active: true, lastRunAt: null,
    };
    mutate((s) => s.automations.push(a));
    return a;
  },
  async listMemories() {
    return [...(load().memories ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async addMemory(fact) {
    return mutate((s) => {
      s.memories ??= [];
      if (s.memories.some((m) => sameFact(m.fact, fact))) return { ok: false as const, reason: "duplicate" as const };
      if (s.memories.length >= MAX_MEMORIES) return { ok: false as const, reason: "full" as const };
      const memory: Memory = { id: id(), fact: fact.trim(), createdAt: new Date().toISOString() };
      s.memories.push(memory);
      return { ok: true as const, memory };
    });
  },
  async clearMemories() {
    return mutate((s) => { const n = s.memories?.length ?? 0; s.memories = []; return n; });
  },
  async removeItem(kind, rid) {
    return mutate((s) => {
      if (kind === "recurring") { const n = s.recurrences.length; s.recurrences = s.recurrences.filter((x) => x.id !== rid); return s.recurrences.length < n; }
      if (kind === "memory") { const n = s.memories?.length ?? 0; s.memories = (s.memories ?? []).filter((m) => m.id !== rid); return (s.memories?.length ?? 0) < n; }
      if (kind === "project") { const n = s.projects.length; s.projects = s.projects.filter((p) => p.id !== rid); return s.projects.length < n; }
      if (kind === "goal") { const n = s.goals.length; s.goals = s.goals.filter((g) => g.id !== rid); return s.goals.length < n; }
      if (kind === "automation") { const n = s.automations.length; s.automations = s.automations.filter((x) => x.id !== rid); return s.automations.length < n; }
      // ficha e plano: tira todo o grupo a que o item pertence
      const list = kind === "workout" ? s.workouts : s.meals;
      const item = list.find((x) => x.id === rid);
      if (!item) return false;
      const group = (s.plans ?? []).find((p) => p.kind === kind && p.ids.includes(rid));
      const gone = new Set(group ? group.ids : [rid]);
      if (kind === "workout") s.workouts = s.workouts.filter((w) => !gone.has(w.id)); else s.meals = s.meals.filter((m) => !gone.has(m.id));
      if (group) s.plans = (s.plans ?? []).filter((p) => p.id !== group.id);
      return true;
    });
  },
  async setAutomationActive(aid, active) {
    return mutate((s) => {
      const a = s.automations.find((x) => x.id === aid);
      if (a) a.active = active;
      return !!a;
    });
  },
  async addNotice(n) {
    mutate((s) => s.notices.push({ id: id(), ...n, createdAt: new Date().toISOString(), readAt: null }));
  },
  async listBudgets() {
    return load().budgets ?? [];
  },
  async setBudget(categoryId, amountCents) {
    let ok = false;
    mutate((s) => {
      if (!s.categories.some((c) => c.id === categoryId && c.kind === "expense")) return;
      ok = true;
      s.budgets = (s.budgets ?? []).filter((b) => b.categoryId !== categoryId);
      if (amountCents !== null) s.budgets.push({ categoryId, amountCents });
    });
    return ok;
  },
  async listNotices() {
    return load().notices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async markNoticesRead(ids) {
    mutate((s) => {
      const at = new Date().toISOString();
      for (const n of s.notices) if (!n.readAt && (ids === "all" || ids.includes(n.id))) n.readAt = at;
    });
  },
  async listEvents() {
    const s = load();
    // só as agendas conectadas aparecem
    return s.events.filter((e) => s.settings.calendars[e.source]).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
  async listFocusSessions() {
    return load().focusSessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },
  async saveFocusSession(input) {
    const f: FocusSession = { ...input, id: id() };
    mutate((s) => s.focusSessions.push(f));
    return f;
  },

  async createWorkoutPlan(input) {
    const planId = id();
    return mutate((s) => {
      s.plans ??= [];
      // a ficha nova passa a valer: as sessões da anterior saem da tela e voltam se desfizer
      const replaced = s.plans.filter((p) => p.kind === "workout" && p.active).map((p) => p.id);
      const sessions = input.sessions.map((x): Workout => ({
        id: id(), name: x.name, weekdays: x.weekdays,
        exercises: x.exercises.map((e) => ({ id: id(), name: e.name, sets: e.sets, reps: e.reps, loadKg: e.loadKg, bestKg: e.loadKg })),
      }));
      for (const p of s.plans.filter((p) => replaced.includes(p.id))) p.active = false;
      s.plans.push({ id: planId, kind: "workout", active: true, ids: sessions.map((x) => x.id) });
      s.workouts.push(...sessions);
      return { id: planId, replaced };
    });
  },
  async createMealPlan(input) {
    const planId = id();
    return mutate((s) => {
      s.plans ??= [];
      const replaced = s.plans.filter((p) => p.kind === "meal" && p.active).map((p) => p.id);
      const meals = input.meals.map((m): Meal => ({ id: id(), name: m.name, time: m.time ?? "", items: m.items, kcal: m.kcal ?? 0 }));
      for (const p of s.plans.filter((p) => replaced.includes(p.id))) p.active = false;
      s.plans.push({ id: planId, kind: "meal", active: true, ids: meals.map((m) => m.id) });
      s.meals.push(...meals);
      return { id: planId, replaced };
    });
  },
  async listWorkouts() {
    return hidden(load()).workouts;
  },
  async listWorkoutLogs() {
    return load().workoutLogs;
  },
  async setWorkoutDone(workoutId, day, done) {
    return mutate((s) => {
      if (!s.workouts.some((w) => w.id === workoutId)) return false;
      s.workoutLogs = s.workoutLogs.filter((l) => !(l.workoutId === workoutId && l.day === day));
      if (done) s.workoutLogs.push({ workoutId, day });
      return true;
    });
  },
  async listMeals() {
    return hidden(load()).meals.sort((a, b) => a.time.localeCompare(b.time));
  },
  async listMealLogs() {
    return load().mealLogs;
  },
  async setMealDone(mealId, day, done) {
    return mutate((s) => {
      if (!s.meals.some((m) => m.id === mealId)) return false;
      s.mealLogs = s.mealLogs.filter((l) => !(l.mealId === mealId && l.day === day));
      if (done) s.mealLogs.push({ mealId, day });
      return true;
    });
  },
  async listMeasurements() {
    return load().measurements.sort((a, b) => a.day.localeCompare(b.day));
  },
  async addMeasurement(input) {
    const m: BodyMeasurement = { ...input, id: id() };
    mutate((s) => {
      s.measurements = s.measurements.filter((x) => x.day !== input.day);  // uma medida por dia
      s.measurements.push(m);
    });
    return m;
  },

  async getSettings() {
    return load().settings;
  },
  async updateSettings(patch) {
    return mutate((s) => Object.assign(s.settings, patch));
  },
  async deleteAllData() {
    // conta nova e vazia: só categorias padrão, uma conta zerada e preferências padrão
    const fresh = seedState();
    const empty = Object.fromEntries(Object.entries(fresh).map(([k, v]) => [k, Array.isArray(v) ? [] : v])) as unknown as State;
    save({ ...empty, categories: fresh.categories, accounts: fresh.accounts.map((a) => ({ ...a, openingBalanceCents: 0 })),
      settings: { ...fresh.settings, name: "você", email: "", plan: "none", trialEndsOn: null, briefingTime: null,
        calendars: { google: false, outlook: false }, channels: { whatsapp: null, telegram: false, email: false, push: false } } });
  },
};
