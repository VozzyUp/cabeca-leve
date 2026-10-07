import { addDays, DEFAULT_TZ, localDate, zonedToUtc } from "@/lib/time";
import type { DataStore } from "./store";
import type { Account, ActionRecord, Category, ChatMessage, Reminder, Transaction } from "./types";

// Banco em memória com dados de exemplo, só até o /replica-backend ligar o Supabase.
// Vive no globalThis para sobreviver ao recarregamento do servidor de desenvolvimento.

type State = {
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
  return {
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

const g = globalThis as unknown as { __fakeState?: State };
function state(): State {
  g.__fakeState ??= seedState();
  return g.__fakeState;
}

export function resetFakeState(s?: State) {
  g.__fakeState = s ?? seedState();
}

export const fakeStore: DataStore = {
  timezone: () => DEFAULT_TZ,

  async listReminders() {
    return [...state().reminders].sort((a, b) => (a.nextFireAt ?? "9").localeCompare(b.nextFireAt ?? "9"));
  },
  async createReminder({ title, nextFireAt, channels = ["push"] }) {
    const r: Reminder = { id: id(), title, nextFireAt, recurrenceRule: null, channels, status: "active",
      lastFiredAt: null, createdAt: new Date().toISOString() };
    state().reminders.push(r);
    return r;
  },
  async updateReminder(rid, patch) {
    const r = state().reminders.find((x) => x.id === rid);
    if (!r) return null;
    Object.assign(r, patch);
    if (patch.status && patch.status !== "active") r.nextFireAt = null;
    return r;
  },

  async listTransactions() {
    return [...state().transactions].sort((a, b) =>
      b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt));
  },
  async createTransaction(input) {
    const t: Transaction = { ...input, id: id(), createdAt: new Date().toISOString() };
    state().transactions.push(t);
    return t;
  },
  async listCategories() {
    return state().categories;
  },
  async listAccounts() {
    const s = state();
    return s.accounts.map((a) => ({
      ...a,
      balanceCents: a.openingBalanceCents + s.transactions
        .filter((t) => t.accountId === a.id && t.paymentMethod !== "credit")
        .reduce((sum, t) => sum + (t.type === "income" ? t.amountCents : -t.amountCents), 0),
    }));
  },

  async recordAction(entity, entityId) {
    const a: ActionRecord = { id: id(), entity, entityId, operation: "create", undoneAt: null };
    state().actions.push(a);
    return a;
  },
  async undoAction(aid) {
    const s = state();
    const a = s.actions.find((x) => x.id === aid);
    if (!a) return { ok: false, reason: "not_found" };
    if (a.undoneAt) return { ok: false, reason: "already_undone" };
    // desfazer uma criação = remover o item criado
    if (a.entity === "reminder") s.reminders = s.reminders.filter((r) => r.id !== a.entityId);
    else s.transactions = s.transactions.filter((t) => t.id !== a.entityId);
    a.undoneAt = new Date().toISOString();
    await fakeStore.markCardsUndone(aid);
    return { ok: true };
  },

  async listMessages() {
    return state().messages;
  },
  async appendMessage(msg) {
    const m: ChatMessage = { ...msg, id: id(), createdAt: new Date().toISOString() };
    state().messages.push(m);
    return m;
  },
  async markCardsUndone(actionId) {
    for (const m of state().messages) for (const c of m.cards) if (c.actionId === actionId) c.undone = true;
  },
};
