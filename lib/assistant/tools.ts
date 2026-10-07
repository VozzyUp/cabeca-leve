import type { DataStore } from "@/lib/data/store";
import type { ActionCardData, Task, Transaction } from "@/lib/data/types";
import { formatDayLabel, formatMoney, formatTime, localDate } from "@/lib/time";
import { describeWeekdays } from "./weekdays";

// Ferramentas do assistente (ver architecture.md). Cada uma grava, registra a ação
// para o "desfazer" e devolve o card do chat. O agente de verdade (Claude, no
// /replica-backend) chama exatamente estas funções.

const PAYMENT_LABEL: Record<NonNullable<Transaction["paymentMethod"]>, string> = {
  pix: "Pix", debit: "débito", credit: "crédito", cash: "dinheiro", other: "outro",
};

export async function createReminder(
  store: DataStore, input: { title: string; at: Date }, now: Date,
): Promise<ActionCardData> {
  const tz = store.timezone();
  const r = await store.createReminder({ title: input.title, nextFireAt: input.at.toISOString() });
  const action = await store.recordAction("reminder", r.id);
  const day = formatDayLabel(localDate(input.at, tz), now, tz);
  return {
    actionId: action.id, kind: "reminder", title: r.title,
    value: formatTime(r.nextFireAt!, tz), valueTone: "neutral",
    meta: `${day[0].toUpperCase()}${day.slice(1)} · aviso no celular`, href: "/lembretes", undone: false,
  };
}

const PRIORITY_LABEL: Record<Task["priority"], string> = { low: "prioridade baixa", medium: "prioridade média", high: "prioridade alta" };

export async function createTask(
  store: DataStore, input: { title: string; dueOn: string | null; priority: Task["priority"] }, now: Date,
): Promise<ActionCardData> {
  const tz = store.timezone();
  const t = await store.createTask(input);
  const action = await store.recordAction("task", t.id);
  const due = t.dueOn ? formatDayLabel(t.dueOn, now, tz) : "sem prazo";
  return {
    actionId: action.id, kind: "task", title: t.title, value: due[0].toUpperCase() + due.slice(1),
    valueTone: "neutral", meta: PRIORITY_LABEL[t.priority], href: "/tarefas", undone: false,
  };
}

export async function createHabit(
  store: DataStore, input: { name: string; weekdays: number[]; time: string | null },
): Promise<ActionCardData> {
  const h = await store.createHabit(input);
  const action = await store.recordAction("habit", h.id);
  return {
    actionId: action.id, kind: "habit", title: h.name, value: h.time ?? "sem horário",
    valueTone: "neutral", meta: describeWeekdays(h.weekdays), href: "/habitos", undone: false,
  };
}

export async function recordTransaction(
  store: DataStore,
  input: { type: Transaction["type"]; amountCents: number; description: string; categoryName: string;
    paymentMethod: Transaction["paymentMethod"]; occurredOn?: string },
  now: Date,
): Promise<ActionCardData> {
  const tz = store.timezone();
  const [categories, accounts] = await Promise.all([store.listCategories(), store.listAccounts()]);
  const category = categories.find((c) => c.name === input.categoryName)
    ?? categories.find((c) => c.name === (input.type === "income" ? "Outras entradas" : "Outros gastos"))!;
  const occurredOn = input.occurredOn ?? localDate(now, tz);
  const t = await store.createTransaction({
    type: input.type, amountCents: input.amountCents, occurredOn, description: input.description,
    categoryId: category.id, accountId: accounts[0].id, paymentMethod: input.paymentMethod, source: "chat",
  });
  const action = await store.recordAction("transaction", t.id);
  const day = formatDayLabel(occurredOn, now, tz);
  const parts = [`${day[0].toUpperCase()}${day.slice(1)}`, category.name];
  if (t.paymentMethod) parts.push(PAYMENT_LABEL[t.paymentMethod]);
  const sign = t.type === "income" ? "+" : "−";
  return {
    actionId: action.id, kind: "transaction", title: t.description,
    value: `${sign}${formatMoney(t.amountCents)}`, valueTone: t.type === "income" ? "income" : "expense",
    meta: parts.join(" · "), href: "/dinheiro/extrato", undone: false,
  };
}
