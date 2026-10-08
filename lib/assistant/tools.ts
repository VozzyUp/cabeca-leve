import { budgetAlert, budgetStatus } from "@/lib/domain/finance";
import { categoryFromWords } from "./rule-parser";
import type { DataStore } from "@/lib/data/store";
import type { ActionCardData, Task, Transaction } from "@/lib/data/types";
import { formatDayLabel, formatMoney, formatTime, localDate } from "@/lib/time";
import { describeRepeat } from "@/lib/domain/recurrence";
import { describeWeekdays } from "./weekdays";

// Ferramentas do assistente (ver architecture.md). Cada uma grava, registra a ação
// para o "desfazer" e devolve o card do chat. O agente de verdade (Claude, no
// /replica-backend) chama exatamente estas funções.

const PAYMENT_LABEL: Record<NonNullable<Transaction["paymentMethod"]>, string> = {
  pix: "Pix", debit: "débito", credit: "crédito", cash: "dinheiro", other: "outro",
};

export async function createReminder(
  store: DataStore, input: { title: string; at: Date; recurrenceRule?: string | null }, now: Date,
): Promise<ActionCardData> {
  const tz = store.timezone();
  const r = await store.createReminder({ title: input.title, nextFireAt: input.at.toISOString(), recurrenceRule: input.recurrenceRule ?? null });
  const action = await store.recordAction("reminder", r.id);
  const day = formatDayLabel(localDate(input.at, tz), now, tz);
  const repeats = describeRepeat(r.recurrenceRule);
  return {
    actionId: action.id, kind: "reminder", title: r.title,
    value: formatTime(r.nextFireAt!, tz), valueTone: "neutral",
    meta: repeats ? `${repeats[0].toUpperCase()}${repeats.slice(1)} · começa ${day}` : `${day[0].toUpperCase()}${day.slice(1)} · aviso no celular`,
    href: "/lembretes", undone: false,
  };
}

const PRIORITY_LABEL: Record<Task["priority"], string> = { low: "prioridade baixa", medium: "prioridade média", high: "prioridade alta" };

export async function createTask(
  store: DataStore, input: { title: string; dueOn: string | null; priority: Task["priority"]; notes?: string | null; recurrenceRule?: string | null }, now: Date,
): Promise<ActionCardData> {
  const tz = store.timezone();
  const t = await store.createTask(input);
  const action = await store.recordAction("task", t.id);
  const due = t.dueOn ? formatDayLabel(t.dueOn, now, tz) : "sem prazo";
  const repeats = describeRepeat(t.recurrenceRule);
  return {
    actionId: action.id, kind: "task", title: t.title, value: due[0].toUpperCase() + due.slice(1),
    valueTone: "neutral", meta: [PRIORITY_LABEL[t.priority], repeats && `repete ${repeats}`].filter(Boolean).join(" · "), href: "/tarefas", undone: false,
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
  // nome sem diferença de maiúsculas e acentos; subcategorias valem; senão, "Outros gastos"/"Outras entradas"
  const norm = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
  const sameKind = categories.filter((c) => c.kind === input.type);
  const category = sameKind.find((c) => norm(c.name) === norm(input.categoryName))
    ?? categories.find((c) => c.name === (input.type === "income" ? "Outras entradas" : "Outros gastos"))
    ?? sameKind[0];
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
  // F5: este gasto fez algum teto (da categoria ou da de cima) cruzar 80% ou 100%?
  let alert: string | undefined;
  if (t.type === "expense") {
    const budgets = (await store.listBudgets()).filter((b) => b.categoryId === category.id || b.categoryId === category.parentId);
    if (budgets.length) {
      const all = await store.listTransactions();
      for (const s of budgetStatus(all, categories, budgets, occurredOn.slice(0, 7))) {
        const a = budgetAlert(s, t.amountCents);
        if (a) { alert = a; await store.addNotice({ kind: "bill", title: s.level === "over" ? `Teto estourado: ${s.name}` : `Perto do teto: ${s.name}`, body: a, href: "/dinheiro" }); break; }
      }
    }
  }
  return {
    actionId: action.id, kind: "transaction", title: t.description,
    value: `${sign}${formatMoney(t.amountCents)}`, valueTone: t.type === "income" ? "income" : "expense",
    meta: parts.join(" · "), href: "/dinheiro/extrato", undone: false, ...(alert ? { alert } : {}),
  };
}

// F5: define ou tira o teto do mês de uma categoria de gasto pelo nome ("Alimentação", "ifood", "padaria")
export async function setBudgetByName(store: DataStore, categoryName: string, amountCents: number | null): Promise<{ ok: boolean; text: string }> {
  const norm = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
  const expense = (await store.listCategories()).filter((c) => c.kind === "expense");
  const byWord = categoryFromWords(categoryName);
  const cat = expense.find((c) => norm(c.name) === norm(categoryName)) ?? (byWord ? expense.find((c) => c.name === byWord) : undefined);
  if (!cat) {
    return { ok: false, text: `Não achei a categoria “${categoryName}”. As de gasto são: ${expense.filter((c) => !c.parentId).map((c) => c.name).join(", ")}.` };
  }
  await store.setBudget(cat.id, amountCents);
  return {
    ok: true,
    text: amountCents === null
      ? `Pronto, tirei o teto de ${cat.name}.`
      : `Pronto: teto de ${formatMoney(amountCents)} por mês em ${cat.name}. Aviso quando passar de 80% e de 100%.`,
  };
}
