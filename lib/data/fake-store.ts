import fs from "node:fs";
import path from "node:path";
import { addDays, DEFAULT_TZ, localDate, zonedToUtc } from "@/lib/time";
import type { DataStore } from "./store";
import type { Account, ActionRecord, Category, ChatMessage, Habit, HabitLog, Reminder, Task, Transaction } from "./types";

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
  messages: ChatMessage[];
};

const id = () => crypto.randomUUID();

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
    id: id(), title, dueOn: dueIn === null ? null : addDays(today, dueIn), priority,
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
    transactions: [
      tx(6, "income", 650000, "Salário", "Salário", "other"),
      tx(5, "expense", 18990, "Compra do mês", "Mercado", "debit"),
      tx(3, "expense", 4590, "Assinatura de música", "Assinaturas", "credit"),
      tx(2, "expense", 2350, "Corrida de aplicativo", "Transporte", "pix"),
      tx(1, "expense", 6200, "Jantar com amigos", "Lazer", "pix"),
    ],
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
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as State;
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
  async createReminder({ title, nextFireAt, channels = ["push"] }) {
    const r: Reminder = { id: id(), title, nextFireAt, recurrenceRule: null, channels, status: "active",
      lastFiredAt: null, createdAt: new Date().toISOString() };
    mutate((s) => s.reminders.push(r));
    return r;
  },
  async updateReminder(rid, patch) {
    return mutate((s) => {
      const r = s.reminders.find((x) => x.id === rid);
      if (!r) return null;
      Object.assign(r, patch);
      if (patch.status && patch.status !== "active") r.nextFireAt = null;
      return r;
    });
  },

  async listTasks() {
    return load().tasks;
  },
  async createTask({ title, dueOn, priority = "medium" }) {
    const t: Task = { id: id(), title, dueOn, priority, status: "todo", completedAt: null, createdAt: new Date().toISOString() };
    mutate((s) => s.tasks.push(t));
    return t;
  },
  async updateTask(tid, patch) {
    return mutate((s) => {
      const t = s.tasks.find((x) => x.id === tid);
      if (!t) return null;
      Object.assign(t, patch);
      if (patch.status) t.completedAt = patch.status === "done" ? (t.completedAt ?? new Date().toISOString()) : null;
      return t;
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
  async listCategories() {
    return load().categories;
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

  async recordAction(entity, entityId) {
    const a: ActionRecord = { id: id(), entity, entityId, operation: "create", undoneAt: null };
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
      } else s.transactions = s.transactions.filter((t) => t.id !== a.entityId);
      a.undoneAt = new Date().toISOString();
      for (const m of s.messages) for (const c of m.cards) if (c.actionId === aid) c.undone = true;
      return { ok: true };
    });
  },

  async listMessages() {
    return load().messages;
  },
  async appendMessage(msg) {
    const m: ChatMessage = { ...msg, id: id(), createdAt: new Date().toISOString() };
    mutate((s) => s.messages.push(m));
    return m;
  },
  async markCardsUndone(actionId) {
    mutate((s) => { for (const m of s.messages) for (const c of m.cards) if (c.actionId === actionId) c.undone = true; });
  },
};
