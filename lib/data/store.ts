import type {
  Account, ActionRecord, Automation, BodyMeasurement, CalendarEvent, Category, ChatMessage, CreditCard, FocusSession, Goal,
  Habit, HabitLog, InstallmentPurchase, Meal, MealLog, Note, Notice, Project, Recurrence, Reminder, Settings, Task,
  Budget, Memory, SupportTicket, Transaction, Workout, WorkoutLog,
} from "./types";

export type AiUsageInput = { model: string; calls: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };

// Criação pelo chat (treino, alimentação, projetos, metas e revisões agendadas)
export type WorkoutPlanInput = {
  name: string;
  sessions: Array<{ name: string; weekdays: number[]; exercises: Array<{ name: string; sets: number; reps: number; loadKg: number | null; restSeconds: number | null }> }>;
};
export type MealPlanInput = {
  name: string; kcalTraining: number | null; kcalRest: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null;
  meals: Array<{ name: string; time: string | null; items: string[]; kcal: number | null }>;
};
export type ProjectInput = { name: string; description: string; startsOn: string | null; dueOn: string | null; milestones: Array<{ title: string; dueOn: string | null }> };
// targetValue e monthlyPlan em centavos quando unit = "money"
export type GoalInput = { title: string; unit: "money" | "count"; targetValue: number; monthlyPlan: number | null; dueOn: string | null };
export type AutomationSource = "tasks" | "projects" | "habits" | "goals" | "finance" | "notes";
export type AutomationInput = {
  title: string; prompt: string; schedule: Automation["schedule"]; weekdays: number[]; runOn: string | null; time: string;
  channel: Automation["channel"]; sources: AutomationSource[]; lookbackDays: number;
};
export type PlanCreated = { id: string; replaced: string[] };
export type RemovableKind = "workout" | "meal" | "project" | "goal" | "automation" | "memory" | "recurring";
// Conta fixa ou entrada que se repete todo mês. fromThisMonth: o vencimento deste mês ainda vale mesmo que o dia já tenha passado
export type RecurrenceInput = { kind: Recurrence["kind"]; description: string; amountCents: number; dayOfMonth: number; categoryId: string | null; paymentMethod: Recurrence["paymentMethod"]; fromThisMonth: boolean };
export const MAX_MEMORIES = 100;
export type MemoryResult = { ok: true; memory: Memory } | { ok: false; reason: "duplicate" | "full" };

// Mensagem a gravar. `content` são os blocos exatos da API (reenviados byte a byte ao modelo);
// `visible: false` guarda passos internos do agente (chamadas e resultados de ferramenta).
export type AppendMessage = Omit<ChatMessage, "id" | "createdAt" | "role"> & {
  role: "user" | "assistant" | "system";
  content?: unknown;
  visible?: boolean;
  channel?: "web" | "whatsapp" | "telegram" | "voice" | "job";
  clientMessageId?: string;
  externalMessageId?: string;
  usage?: { model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number };
};

export type TranscriptEntry = { role: "user" | "assistant" | "system"; content: unknown };

// Contrato da camada de dados. Duas implementações: supabase-store (produção) e
// fake-store (modo de demonstração, sem Supabase). As telas não sabem qual está por trás.
export interface DataStore {
  timezone(): string;
  listReminders(): Promise<Reminder[]>;
  createReminder(input: { title: string; nextFireAt: string; channels?: Reminder["channels"]; recurrenceRule?: string | null }): Promise<Reminder>;
  // lastFiredAt num lembrete recorrente avança nextFireAt para a próxima ocorrência
  updateReminder(id: string, patch: Partial<Pick<Reminder, "status" | "lastFiredAt" | "nextFireAt" | "title" | "recurrenceRule">>): Promise<Reminder | null>;
  deleteReminder(id: string): Promise<boolean>;
  listTasks(): Promise<Task[]>;
  createTask(input: { title: string; dueOn: string | null; priority?: Task["priority"]; notes?: string | null; recurrenceRule?: string | null }): Promise<Task>;
  // concluir uma tarefa recorrente cria a próxima ocorrência
  updateTask(id: string, patch: Partial<Pick<Task, "title" | "dueOn" | "priority" | "status" | "notes" | "recurrenceRule">>): Promise<Task | null>;
  deleteTask(id: string): Promise<boolean>;
  listHabits(): Promise<Habit[]>;
  createHabit(input: { name: string; weekdays?: number[]; time?: string | null }): Promise<Habit>;
  archiveHabit(id: string): Promise<boolean>;
  listHabitLogs(): Promise<HabitLog[]>;
  setHabitDone(habitId: string, day: string, done: boolean): Promise<boolean>;
  listTransactions(): Promise<Transaction[]>;
  createTransaction(input: Omit<Transaction, "id" | "createdAt">): Promise<Transaction>;
  updateTransaction(id: string, patch: Partial<Pick<Transaction, "description" | "amountCents" | "categoryId" | "occurredOn" | "paymentMethod" | "type">>): Promise<Transaction | null>;
  deleteTransaction(id: string): Promise<boolean>;
  listCategories(): Promise<Category[]>;
  createCategory(input: { name: string; kind: Category["kind"]; parentId: string | null }): Promise<Category>;
  updateCategory(id: string, patch: { name: string }): Promise<Category | null>;
  archiveCategory(id: string): Promise<boolean>;
  listAccounts(): Promise<Array<Account & { balanceCents: number }>>;
  recordAction(entity: ActionRecord["entity"], entityId: string, replaced?: string[]): Promise<ActionRecord>;
  // custo da IA: tokens de uma mensagem respondida, somados por modelo (tela /admin/custos)
  recordAiUsage(rows: AiUsageInput[]): Promise<void>;
  undoAction(id: string): Promise<{ ok: true } | { ok: false; reason: "not_found" | "already_undone" }>;
  listMessages(): Promise<ChatMessage[]>;
  appendMessage(msg: AppendMessage): Promise<ChatMessage>;
  markCardsUndone(actionId: string): Promise<void>;
  // conversa de hoje como a API recebe (blocos exatos, em ordem, inclusive os passos internos)
  listTodayTranscript(): Promise<TranscriptEntry[]>;
  // mensagens que a pessoa mandou desde um instante (limite de uso)
  countUserMessagesSince(iso: string): Promise<number>;
  aiCostSince(iso: string): Promise<number>;  // US$ gastos com a IA desde o instante (0 na demonstração)
  // falar com uma pessoa (F3): null no modo de demonstração
  openSupportTicket(message: string, channel: "web" | "whatsapp" | "voice"): Promise<{ protocol: string; dueAt: string } | null>;
  listSupportTickets(): Promise<SupportTicket[]>;
  // um turno do assistente por vez na conversa de hoje (mensagens que chegam juntas esperam a vez)
  withTurn<T>(fn: () => Promise<T>): Promise<T>;

  // finanças (M3)
  listCards(): Promise<CreditCard[]>;
  listRecurrences(): Promise<Recurrence[]>;
  setRecurrenceActive(id: string, active: boolean): Promise<boolean>;
  createRecurrence(input: RecurrenceInput): Promise<Recurrence>;
  listInstallments(): Promise<InstallmentPurchase[]>;

  // organização (M3)
  listProjects(): Promise<Project[]>;
  setMilestoneDone(projectId: string, milestoneId: string, done: boolean): Promise<boolean>;
  listGoals(): Promise<Goal[]>;
  addGoalProgress(id: string, delta: number): Promise<Goal | null>;
  listNotes(): Promise<Note[]>;
  createNote(input: Pick<Note, "title" | "body" | "notebook" | "kind">): Promise<Note>;
  updateNote(id: string, patch: Partial<Pick<Note, "title" | "body" | "pinned" | "notebook">>): Promise<Note | null>;
  createProject(input: ProjectInput): Promise<Project>;
  createGoal(input: GoalInput): Promise<Goal>;
  listAutomations(): Promise<Automation[]>;
  createAutomation(input: AutomationInput): Promise<Automation>;
  setAutomationActive(id: string, active: boolean): Promise<boolean>;
  // tira da tela: projeto e meta vão para arquivados, a ficha e o plano ficam inativos, a revisão é apagada
  removeItem(kind: RemovableKind, id: string): Promise<boolean>;
  listNotices(): Promise<Notice[]>;
  addNotice(n: { kind: Notice["kind"]; title: string; body: string; href: string | null }): Promise<void>;
  // tetos de gastos (F5): null tira o teto
  listBudgets(): Promise<Budget[]>;
  setBudget(categoryId: string, amountCents: number | null): Promise<boolean>;
  markNoticesRead(ids: string[] | "all"): Promise<void>;
  listEvents(): Promise<CalendarEvent[]>;
  listFocusSessions(): Promise<FocusSession[]>;
  saveFocusSession(input: Omit<FocusSession, "id">): Promise<FocusSession>;

  // memória do assistente: fatos que a pessoa pediu para guardar (no máximo 100; o repetido não entra)
  listMemories(): Promise<Memory[]>;
  addMemory(fact: string): Promise<MemoryResult>;
  clearMemories(): Promise<number>;

  // saúde (M4)
  // a ficha nova passa a valer; a ativa antes dela fica em `replaced` (o desfazer a reativa)
  createWorkoutPlan(input: WorkoutPlanInput): Promise<PlanCreated>;
  createMealPlan(input: MealPlanInput): Promise<PlanCreated>;
  listWorkouts(): Promise<Workout[]>;
  listWorkoutLogs(): Promise<WorkoutLog[]>;
  setWorkoutDone(workoutId: string, day: string, done: boolean): Promise<boolean>;
  listMeals(): Promise<Meal[]>;
  listMealLogs(): Promise<MealLog[]>;
  setMealDone(mealId: string, day: string, done: boolean): Promise<boolean>;
  listMeasurements(): Promise<BodyMeasurement[]>;
  addMeasurement(input: Omit<BodyMeasurement, "id">): Promise<BodyMeasurement>;

  // conta e preferências
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  // exclusão de conta: apaga tudo do usuário (no Supabase, cascata a partir de auth.users)
  deleteAllData(): Promise<void>;
}
