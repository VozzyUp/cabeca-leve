import { budgetAlert, budgetStatus } from "@/lib/domain/finance";
import { categoryFromWords } from "./rule-parser";
import type { AutomationInput, DataStore, GoalInput, MealPlanInput, ProjectInput, RecurrenceInput, WorkoutPlanInput } from "@/lib/data/store";
import { toResolve } from "@/lib/domain/resolve";
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
  onCreated?: (t: Transaction) => void,  // o agente usa para montar o termômetro do gasto
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
  onCreated?.(t);
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

// ---- Treino, alimentação, projetos, metas e revisões agendadas ----

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export async function createWorkoutPlan(store: DataStore, input: WorkoutPlanInput): Promise<ActionCardData> {
  const created = await store.createWorkoutPlan(input);
  const action = await store.recordAction("workout_plan", created.id, created.replaced);
  const exercises = input.sessions.reduce((n, x) => n + x.exercises.length, 0);
  const days = input.sessions.map((x) => (x.weekdays.length ? `${x.name} (${describeWeekdays(x.weekdays)})` : x.name)).join("; ");
  return {
    actionId: action.id, kind: "workout", title: input.name, value: plural(input.sessions.length, "treino", "treinos"), valueTone: "neutral",
    meta: `${plural(exercises, "exercício", "exercícios")} · ${days}`, href: "/saude/treino", undone: false,
  };
}

export async function createMealPlan(store: DataStore, input: MealPlanInput): Promise<ActionCardData> {
  const created = await store.createMealPlan(input);
  const action = await store.recordAction("meal_plan", created.id, created.replaced);
  const kcal = input.kcalTraining ?? input.kcalRest;
  return {
    actionId: action.id, kind: "meal", title: input.name, value: plural(input.meals.length, "refeição", "refeições"), valueTone: "neutral",
    meta: [kcal ? `${kcal} kcal por dia` : null, input.meals.map((m) => (m.time ? `${m.name} ${m.time}` : m.name)).join(", ")].filter(Boolean).join(" · "),
    href: "/saude/dieta", undone: false,
  };
}

export async function createProject(store: DataStore, input: ProjectInput, now: Date): Promise<ActionCardData> {
  const p = await store.createProject(input);
  const action = await store.recordAction("project", p.id);
  const tz = store.timezone();
  const due = p.dueOn ? `até ${formatDayLabel(p.dueOn, now, tz)}` : "sem prazo";
  return {
    actionId: action.id, kind: "project", title: p.name, value: due, valueTone: "neutral",
    meta: p.milestones.length ? `${plural(p.milestones.length, "etapa", "etapas")}: ${p.milestones.map((m) => m.title).join(", ")}` : "sem etapas ainda", href: "/projetos", undone: false,
  };
}

export async function createGoal(store: DataStore, input: GoalInput, now: Date): Promise<ActionCardData> {
  const g = await store.createGoal(input);
  const action = await store.recordAction("goal", g.id);
  const tz = store.timezone();
  const target = g.unit === "money" ? formatMoney(g.targetValue) : String(g.targetValue);
  const meta = [g.dueOn ? `até ${formatDayLabel(g.dueOn, now, tz)}` : "sem prazo", input.monthlyPlan ? `ritmo ${g.unit === "money" ? formatMoney(input.monthlyPlan) : input.monthlyPlan} por mês` : null].filter(Boolean).join(" · ");
  return { actionId: action.id, kind: "goal", title: g.title, value: target, valueTone: "neutral", meta, href: "/metas", undone: false };
}

const CHANNEL_NAME = { push: "aviso no celular", whatsapp: "WhatsApp", email: "e-mail" } as const;
const SCHEDULE_NAME = { daily: "todo dia", weekly: "", monthly: "todo dia 1", once: "uma vez" } as const;

export async function createAutomation(store: DataStore, input: AutomationInput, now: Date): Promise<ActionCardData> {
  const a = await store.createAutomation(input);
  const action = await store.recordAction("automation", a.id);
  const tz = store.timezone();
  const when = a.schedule === "weekly" ? describeWeekdays(a.weekdays) : a.schedule === "once" && a.runOn ? formatDayLabel(a.runOn, now, tz) : SCHEDULE_NAME[a.schedule];
  return {
    actionId: action.id, kind: "automation", title: a.title, value: a.time, valueTone: "neutral",
    meta: `${when[0].toUpperCase()}${when.slice(1)} · ${CHANNEL_NAME[a.channel]}`, href: "/automacoes", undone: false,
  };
}

// ---- Contas fixas e "a resolver" ----

const FIXED_LABEL = { bill: "conta", subscription: "assinatura", income: "entrada" } as const;

export async function createRecurring(store: DataStore, input: RecurrenceInput): Promise<ActionCardData> {
  const r = await store.createRecurrence(input);
  const action = await store.recordAction("recurrence", r.id);
  return {
    actionId: action.id, kind: "recurring", title: r.description, value: formatMoney(r.amountCents), valueTone: r.kind === "income" ? "income" : "expense",
    meta: `${FIXED_LABEL[r.kind][0].toUpperCase()}${FIXED_LABEL[r.kind].slice(1)} fixa · todo dia ${r.dayOfMonth}${input.fromThisMonth ? " · este mês ainda em aberto" : ""}`, href: "/dinheiro/fixos", undone: false,
  };
}

// Confirma que a conta fixa foi paga (ou a entrada recebida): lança no vencimento, com o valor combinado.
// Sem o dia, vale o vencimento em aberto mais antigo. Confirmar duas vezes não duplica.
export async function confirmBill(store: DataStore, recurrenceId: string, dueOn: string | null, now: Date): Promise<{ ok: true; card: ActionCardData } | { ok: false; text: string }> {
  const tz = store.timezone();
  const [recurrences, transactions] = await Promise.all([store.listRecurrences(), store.listTransactions()]);
  const r = recurrences.find((x) => x.id === recurrenceId);
  if (!r) return { ok: false, text: "Não achei essa conta fixa." };
  const today = localDate(now, tz);
  const open = toResolve(recurrences, transactions, today).filter((p) => p.recurrenceId === r.id);
  // sem o dia, só vale o que está em aberto neste mês; o do mês que vem (perto da virada) precisa ser pedido pelo dia
  const target = dueOn ? open.find((p) => p.dueOn === dueOn) : open.find((p) => p.dueOn.startsWith(today.slice(0, 7)));
  if (!target) return { ok: false, text: `“${r.description}” já está resolvida neste mês.` };

  const categories = await store.listCategories();
  const byName = (name: string) => categories.find((c) => c.name === name)?.id ?? null;
  const categoryId = r.categoryId ?? byName(r.kind === "income" ? "Outras entradas" : r.kind === "subscription" ? "Assinaturas" : "Contas da casa");
  const accounts = await store.listAccounts();
  let t;
  try {
    t = await store.createTransaction({
      type: r.kind === "income" ? "income" : "expense", amountCents: r.amountCents, occurredOn: target.dueOn, description: r.description,
      categoryId, accountId: accounts[0]?.id ?? "", paymentMethod: r.paymentMethod, source: "manual", recurrenceId: r.id,
    });
  } catch (error) {
    // duas confirmações juntas: a segunda bate na regra de um lançamento por conta e vencimento
    if (error instanceof Error && /duplicate key|recurrence_id/.test(error.message)) return { ok: false, text: `“${r.description}” já estava confirmada.` };
    throw error;
  }
  const action = await store.recordAction("transaction", t.id);
  const sign = t.type === "income" ? "+" : "−";
  return {
    ok: true,
    card: {
      actionId: action.id, kind: "transaction", title: t.description, value: `${sign}${formatMoney(t.amountCents)}`, valueTone: t.type === "income" ? "income" : "expense",
      meta: `${r.kind === "income" ? "Entrada" : "Conta"} fixa · vencimento ${formatDayLabel(target.dueOn, now, tz)}`, href: "/dinheiro/extrato", undone: false,
    },
  };
}
