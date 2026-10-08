// Tipos de domínio compartilhados pelas telas e pela camada de dados.
// Espelham as tabelas de replica/schema.sql (só os campos que as telas usam).

export type Reminder = {
  id: string;
  title: string;
  nextFireAt: string | null;  // ISO UTC
  recurrenceRule: string | null;
  channels: Array<"push" | "whatsapp" | "telegram" | "email">;
  status: "active" | "done" | "canceled";
  lastFiredAt: string | null;
  createdAt: string;
};

export type Task = {
  id: string;
  title: string;
  dueOn: string | null;       // dia local AAAA-MM-DD
  priority: "low" | "medium" | "high";
  status: "todo" | "doing" | "done";
  completedAt: string | null;
  createdAt: string;
};

export type Habit = {
  id: string;
  name: string;
  weekdays: number[];         // 0 = domingo
  time: string | null;        // "HH:MM" planejado
  active: boolean;
  createdAt: string;
};

export type HabitLog = { habitId: string; day: string };

export type Category = { id: string; name: string; kind: "expense" | "income" };
export type Account = { id: string; name: string; openingBalanceCents: number };

export type Transaction = {
  id: string;
  type: "expense" | "income";
  amountCents: number;        // sempre positivo; o tipo dá a direção
  occurredOn: string;         // dia local AAAA-MM-DD
  description: string;
  categoryId: string | null;
  accountId: string;
  paymentMethod: "pix" | "debit" | "credit" | "cash" | "other" | null;
  source: "manual" | "chat" | "whatsapp";
  cardId?: string | null;       // compra no cartão de crédito
  recurrenceId?: string | null; // lançamento gerado por um fixo
  createdAt: string;
};

// Card que o assistente devolve no chat para cada item que criou
export type ActionCardData = {
  actionId: string;
  kind: "reminder" | "transaction" | "task" | "habit";
  title: string;
  value: string;
  valueTone: "neutral" | "income" | "expense";
  meta: string;
  href: string;
  undone: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards: ActionCardData[];
  createdAt: string;
};

export type ActionRecord = {
  id: string;
  entity: "reminder" | "transaction" | "task" | "habit";
  entityId: string;
  operation: "create";
  undoneAt: string | null;
};

// ---- Finanças (M3) ----

export type CreditCard = {
  id: string;
  name: string;
  limitCents: number;
  closingDay: number;         // dia do mês em que a fatura fecha
  dueDay: number;             // dia do mês em que a fatura vence
};

// Conta fixa, assinatura ou entrada que se repete todo mês
export type Recurrence = {
  id: string;
  kind: "bill" | "subscription" | "income";
  description: string;
  amountCents: number;
  dayOfMonth: number;
  categoryId: string | null;
  paymentMethod: Transaction["paymentMethod"];
  active: boolean;
};

export type InstallmentPurchase = {
  id: string;
  description: string;
  totalCents: number;
  count: number;              // número de parcelas
  firstMonth: string;         // AAAA-MM da 1ª parcela
  cardId: string | null;
  categoryId: string | null;
};

// ---- Organização (M3) ----

export type Project = {
  id: string;
  name: string;
  description: string;
  dueOn: string | null;
  status: "active" | "done";
  milestones: Array<{ id: string; title: string; done: boolean }>;
};

export type Goal = {
  id: string;
  title: string;
  unit: "money" | "count";
  targetValue: number;        // centavos quando unit = money
  currentValue: number;
  startOn: string;
  dueOn: string | null;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  notebook: string;
  kind: "note" | "journal";
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

// Revisão agendada: um resumo que o assistente manda no dia e hora escolhidos
export type Automation = {
  id: string;
  title: string;
  prompt: string;
  weekdays: number[];
  time: string;               // "HH:MM"
  channel: "push" | "whatsapp" | "email";
  active: boolean;
  lastRunAt: string | null;
};

export type Notice = {
  id: string;
  kind: "reminder" | "briefing" | "automation" | "bill" | "system";
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
};

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;           // ISO UTC
  endsAt: string;
  location: string | null;
  source: "google" | "outlook";
};

export type FocusSession = { id: string; title: string; minutes: number; startedAt: string; finishedAt: string | null };

// ---- Saúde (M4) ----

export type Exercise = { id: string; name: string; sets: number; reps: number; loadKg: number | null; bestKg: number | null };
export type Workout = { id: string; name: string; weekdays: number[]; exercises: Exercise[] };
export type WorkoutLog = { workoutId: string; day: string };

export type Meal = { id: string; name: string; time: string; items: string[]; kcal: number };
export type MealLog = { mealId: string; day: string };

export type BodyMeasurement = { id: string; day: string; weightKg: number | null; waistCm: number | null; hipCm: number | null };

// ---- Conta e preferências ----

export type Settings = {
  name: string;
  email: string;
  timezone: string;
  plan: "trial" | "monthly" | "yearly" | "none";
  trialEndsOn: string | null;
  // assinatura paga: até quando vale e se renova sozinha
  billing?: { periodEnd: string | null; renews: boolean; pastDue: boolean };
  tone: "direct" | "warm" | "playful";
  answerLength: "short" | "detailed";
  voice: "female" | "male";
  memoryEnabled: boolean;
  theme: "dark" | "light" | "system";
  briefingTime: string | null;
  channels: { whatsapp: string | null; whatsappVerified?: boolean; telegram: boolean; email: boolean; push: boolean };
  calendars: { google: boolean; outlook: boolean };
};
