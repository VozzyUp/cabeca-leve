import type { DataStore } from "@/lib/data/store";
import type { ActionCardData, Transaction } from "@/lib/data/types";
import { formatDayLabel, formatMoney, formatTime, localDate } from "@/lib/time";

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
