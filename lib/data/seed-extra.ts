import { addDays, zonedToUtc } from "@/lib/time";
import type {
  Automation, BodyMeasurement, CalendarEvent, Category, CreditCard, FocusSession, Goal, InstallmentPurchase, Meal,
  MealLog, Note, Notice, Project, Recurrence, Settings, Transaction, Workout, WorkoutLog,
} from "./types";

// Dados de exemplo das telas do M3 e M4. Determinísticos (mesma entrada, mesmo resultado),
// para as capturas e os testes não mudarem a cada reinício.

const id = () => crypto.randomUUID();

// Gerador pseudoaleatório com semente fixa (LCG)
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const monthStart = (day: string, offset: number) => {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 10);
};
const daysInMonth = (day: string) => {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const withDay = (monthDay: string, d: number) => `${monthDay.slice(0, 8)}${String(Math.min(d, daysInMonth(monthDay))).padStart(2, "0")}`;

type Ctx = { today: string; now: Date; tz: string; categories: Category[]; accountId: string; skipSalaryMonth: string };

export function seedFinance(ctx: Ctx) {
  const { today, now, categories, accountId } = ctx;
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;
  const card: CreditCard = { id: id(), name: "Cartão principal", limitCents: 500000, closingDay: 3, dueDay: 10 };
  const rec = (kind: Recurrence["kind"], description: string, amountCents: number, dayOfMonth: number, category: string,
    paymentMethod: Recurrence["paymentMethod"]): Recurrence =>
    ({ id: id(), kind, description, amountCents, dayOfMonth, categoryId: cat(category), paymentMethod, active: true });
  const recurrences = [
    rec("income", "Salário", 650000, 1, "Salário", "other"),
    rec("bill", "Aluguel", 180000, 5, "Moradia", "pix"),
    rec("bill", "Academia", 9900, 10, "Saúde", "debit"),
    rec("bill", "Internet", 12000, 15, "Contas da casa", "debit"),
    rec("subscription", "Streaming de filmes", 3990, 20, "Assinaturas", "credit"),
  ];
  const installments: InstallmentPurchase[] = [
    { id: id(), description: "Notebook", totalCents: 480000, count: 10, firstMonth: monthStart(today, -3).slice(0, 7), cardId: card.id, categoryId: cat("Compras") },
    { id: id(), description: "Sofá da sala", totalCents: 240000, count: 6, firstMonth: monthStart(today, -1).slice(0, 7), cardId: card.id, categoryId: cat("Compras") },
  ];

  // Histórico de 6 meses. Os variáveis vão até uma semana atrás (a última semana fica com os exemplos feitos à mão)
  const until = addDays(today, -7);
  const rand = rng(20261007);
  const transactions: Transaction[] = [];
  const push = (occurredOn: string, type: Transaction["type"], amountCents: number, description: string, category: string,
    paymentMethod: Transaction["paymentMethod"], recurrenceId: string | null = null) => {
    transactions.push({
      id: id(), type, amountCents, occurredOn, description, categoryId: cat(category), accountId, paymentMethod,
      source: "manual", cardId: paymentMethod === "credit" ? card.id : null, recurrenceId,
      createdAt: zonedToUtc(...(occurredOn.split("-").map(Number) as [number, number, number]), 12, 0, ctx.tz).toISOString(),
    });
  };
  const variable: Array<[string, string, number, number, Transaction["paymentMethod"]]> = [
    // descrição, categoria, mínimo, máximo (centavos), forma
    ["Almoço", "Alimentação", 2800, 5500, "pix"],
    ["Café", "Alimentação", 800, 1800, "debit"],
    ["Corrida de aplicativo", "Transporte", 1400, 3800, "pix"],
    ["Combustível", "Transporte", 15000, 24000, "debit"],
    ["Mercado", "Mercado", 9000, 28000, "credit"],
    ["Farmácia", "Saúde", 2500, 9000, "debit"],
    ["Cinema", "Lazer", 3500, 7000, "credit"],
    ["Delivery", "Alimentação", 4500, 9500, "credit"],
    ["Roupa", "Compras", 8000, 22000, "credit"],
  ];
  for (let offset = -5; offset <= 0; offset++) {
    const first = monthStart(today, offset);
    for (const r of recurrences) {
      const day = withDay(first, r.dayOfMonth);
      if (day > today) continue;  // fixos já lançados até hoje; só os gastos variáveis param uma semana antes
      if (r.kind === "income" && first.slice(0, 7) === ctx.skipSalaryMonth) continue;
      const category = categories.find((c) => c.id === r.categoryId)!.name;
      push(day, r.kind === "income" ? "income" : "expense", r.amountCents, r.description, category, r.paymentMethod, r.id);
    }
    for (let d = 1; d <= daysInMonth(first); d++) {
      const day = withDay(first, d);
      if (day > until) break;
      const count = rand() < 0.35 ? 0 : rand() < 0.75 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const [description, category, min, max, method] = variable[Math.floor(rand() * variable.length)];
        push(day, "expense", Math.round((min + rand() * (max - min)) / 10) * 10, description, category, method);
      }
    }
  }
  return { cards: [card], recurrences, installments, transactions, createdAt: now.toISOString() };
}

export function seedOrganization(ctx: { today: string; now: Date; tz: string }) {
  const { today, now, tz } = ctx;
  const at = (days: number, hour: number, minute = 0) => {
    const [y, m, d] = addDays(today, days).split("-").map(Number);
    return zonedToUtc(y, m, d, hour, minute, tz).toISOString();
  };
  const ms = (title: string, done = false) => ({ id: id(), title, done });
  const projects: Project[] = [
    { id: id(), name: "Mudança de apartamento", description: "Sair do aluguel atual até o fim do mês que vem.", dueOn: addDays(today, 40), status: "active",
      milestones: [ms("Visitar três apartamentos", true), ms("Assinar o contrato", true), ms("Contratar a mudança"), ms("Transferir a internet"), ms("Entregar as chaves")] },
    { id: id(), name: "Curso de inglês", description: "Terminar o módulo intermediário.", dueOn: addDays(today, 75), status: "active",
      milestones: [ms("Unidade 1", true), ms("Unidade 2", true), ms("Unidade 3", true), ms("Unidade 4"), ms("Prova final")] },
    { id: id(), name: "Declaração do imposto", description: "Entregue sem pendências.", dueOn: addDays(today, -120), status: "done",
      milestones: [ms("Juntar os informes", true), ms("Preencher", true), ms("Enviar", true)] },
  ];
  const goals: Goal[] = [
    { id: id(), title: "Reserva de emergência", unit: "money", targetValue: 2000000, currentValue: 1240000, startOn: addDays(today, -150), dueOn: addDays(today, 180) },
    { id: id(), title: "Ler 12 livros no ano", unit: "count", targetValue: 12, currentValue: 8, startOn: `${today.slice(0, 4)}-01-01`, dueOn: `${today.slice(0, 4)}-12-31` },
    { id: id(), title: "Viagem de férias", unit: "money", targetValue: 600000, currentValue: 90000, startOn: addDays(today, -30), dueOn: addDays(today, 240) },
  ];
  const note = (title: string, body: string, notebook: string, daysAgo: number, pinned = false, kind: Note["kind"] = "note"): Note =>
    ({ id: id(), title, body, notebook, kind, pinned, createdAt: at(-daysAgo, 10), updatedAt: at(-daysAgo, 10) });
  const notes: Note[] = [
    note("Ideias para o aniversário", "Reservar o salão até sexta. Bolo de chocolate com morango. Lista: família, amigos do trabalho, vizinhos.", "Pessoal", 1, true),
    note("Livros recomendados", "Indicações da Ana: dois romances e um de finanças pessoais.", "Leituras", 6),
    note("Reunião de segunda", "Prazo do orçamento: dia 20. Revisar os números de setembro antes de mandar.", "Trabalho", 3),
    note("Hoje", "Dia produtivo. Consegui treinar de manhã e terminar o relatório.", "Diário", 0, false, "journal"),
    note("Ontem", "Cansado, dormi tarde. Amanhã quero acordar às 6h30.", "Diário", 1, false, "journal"),
  ];
  const automations: Automation[] = [
    { id: id(), title: "Resumo da manhã", prompt: "Compromissos, tarefas e contas do dia, em poucas linhas.", schedule: "weekly", runOn: null, weekdays: [1, 2, 3, 4, 5], time: "07:00", channel: "whatsapp", active: true, lastRunAt: at(0, 7) },
    { id: id(), title: "Revisão da semana", prompt: "O que foi feito, o que ficou e quanto gastei na semana.", schedule: "weekly", runOn: null, weekdays: [0], time: "19:00", channel: "push", active: true, lastRunAt: at(-3, 19) },
    { id: id(), title: "Fechamento do mês", prompt: "Quanto entrou, saiu e sobrou, comparado ao mês anterior.", schedule: "monthly", runOn: null, weekdays: [], time: "09:00", channel: "email", active: false, lastRunAt: null },
  ];
  const notice = (kind: Notice["kind"], title: string, body: string, hoursAgo: number, read: boolean, href: string | null): Notice =>
    ({ id: id(), kind, title, body, href, createdAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(), readAt: read ? now.toISOString() : null });
  const notices: Notice[] = [
    notice("briefing", "Seu dia", "3 tarefas, 1 compromisso e a conta de internet vence amanhã.", 2, false, "/briefing"),
    notice("bill", "Conta vencendo", "Internet, R$ 120,00, vence em 2 dias.", 5, false, "/dinheiro/fixos"),
    notice("reminder", "Lembrete", "Levar o carro na revisão.", 50, true, "/lembretes"),
    notice("automation", "Revisão da semana", "Você concluiu 9 tarefas e gastou R$ 812,40 na semana.", 75, true, "/automacoes"),
    notice("system", "Bem-vindo", "Conte o que precisa na conversa: tarefas, gastos, lembretes, hábitos.", 400, true, "/conversa"),
  ];
  const ev = (title: string, days: number, hour: number, minutes: number, source: CalendarEvent["source"], location: string | null = null): CalendarEvent =>
    ({ id: id(), title, startsAt: at(days, hour), endsAt: new Date(new Date(at(days, hour)).getTime() + minutes * 60_000).toISOString(), location, source });
  const events: CalendarEvent[] = [
    ev("Reunião de alinhamento", 0, 10, 60, "google", "Sala 3"),
    ev("Almoço com a Júlia", 0, 12, 90, "google", "Restaurante do centro"),
    ev("Dentista", 2, 15, 60, "google", "Clínica Sorriso"),
    ev("Entrega do relatório", 3, 9, 30, "outlook"),
    ev("Aniversário da mãe", 9, 19, 180, "google"),
    ev("Revisão trimestral", -2, 14, 60, "outlook"),
    ev("Consulta de rotina", 16, 8, 60, "google"),
  ];
  const focusSessions: FocusSession[] = [
    { id: id(), title: "Enviar o orçamento para o cliente", minutes: 25, startedAt: at(-1, 9), finishedAt: at(-1, 9, 25) },
    { id: id(), title: "Estudar inglês", minutes: 50, startedAt: at(-1, 20), finishedAt: at(-1, 20, 50) },
  ];
  return { projects, goals, notes, automations, notices, events, focusSessions };
}

export function seedHealth(ctx: { today: string }) {
  const { today } = ctx;
  const ex = (name: string, sets: number, reps: number, loadKg: number | null, bestKg: number | null) => ({ id: id(), name, sets, reps, loadKg, bestKg });
  const workouts: Workout[] = [
    { id: id(), name: "Treino A · superiores", weekdays: [1, 5], exercises: [
      ex("Supino reto", 4, 10, 40, 45), ex("Remada curvada", 4, 10, 35, 35), ex("Desenvolvimento", 3, 12, 14, 16), ex("Rosca direta", 3, 12, 12, 12)] },
    { id: id(), name: "Treino B · inferiores", weekdays: [3], exercises: [
      ex("Agachamento", 4, 10, 60, 70), ex("Leg press", 4, 12, 140, 160), ex("Cadeira flexora", 3, 12, 35, 40), ex("Panturrilha", 4, 15, 50, null)] },
  ];
  const workoutLogs: WorkoutLog[] = [];
  for (let d = 1; d <= 21; d++) {
    const day = addDays(today, -d);
    const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
    for (const w of workouts) if (w.weekdays.includes(wd) && d !== 9) workoutLogs.push({ workoutId: w.id, day });
  }
  const meals: Meal[] = [
    { id: id(), name: "Café da manhã", time: "07:30", items: ["2 ovos mexidos", "1 fatia de pão integral", "café sem açúcar"], kcal: 380 },
    { id: id(), name: "Almoço", time: "12:30", items: ["arroz (4 colheres)", "feijão (1 concha)", "frango grelhado (120 g)", "salada à vontade"], kcal: 620 },
    { id: id(), name: "Lanche", time: "16:00", items: ["iogurte natural", "1 fruta"], kcal: 220 },
    { id: id(), name: "Jantar", time: "20:00", items: ["omelete de legumes", "salada"], kcal: 450 },
  ];
  const mealLogs: MealLog[] = [{ mealId: meals[0].id, day: today }];
  for (let d = 1; d <= 6; d++) for (const m of meals.slice(0, d % 3 === 0 ? 2 : 4)) mealLogs.push({ mealId: m.id, day: addDays(today, -d) });
  const measurements: BodyMeasurement[] = [];
  for (let w = 11; w >= 0; w--) {
    measurements.push({ id: id(), day: addDays(today, -w * 7), weightKg: Math.round((84.6 - (11 - w) * 0.35 + (w % 3 === 0 ? 0.3 : 0)) * 10) / 10,
      waistCm: w % 4 === 0 ? 92 - (11 - w) * 0.5 : null, hipCm: w % 4 === 0 ? 101 - (11 - w) * 0.25 : null });
  }
  return { workouts, workoutLogs, meals, mealLogs, measurements };
}

export function seedSettings(ctx: { today: string; tz: string }): Settings {
  return {
    name: "Fernanda", email: "voce@exemplo.com.br", timezone: ctx.tz, plan: "trial", trialEndsOn: addDays(ctx.today, 5),
    tone: "warm", answerLength: "short", voice: "female", memoryEnabled: true, theme: "dark", briefingTime: "07:00",
    channels: { whatsapp: null, telegram: false, email: true, push: true }, calendars: { google: true, outlook: false },
  };
}
