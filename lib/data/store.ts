import type {
  Account, ActionRecord, Automation, BodyMeasurement, CalendarEvent, Category, ChatMessage, CreditCard, FocusSession, Goal,
  Habit, HabitLog, InstallmentPurchase, Meal, MealLog, Note, Notice, Project, Recurrence, Reminder, Settings, Task,
  SupportTicket, Transaction, Workout, WorkoutLog,
} from "./types";

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
  recordAction(entity: ActionRecord["entity"], entityId: string): Promise<ActionRecord>;
  undoAction(id: string): Promise<{ ok: true } | { ok: false; reason: "not_found" | "already_undone" }>;
  listMessages(): Promise<ChatMessage[]>;
  appendMessage(msg: AppendMessage): Promise<ChatMessage>;
  markCardsUndone(actionId: string): Promise<void>;
  // conversa de hoje como a API recebe (blocos exatos, em ordem, inclusive os passos internos)
  listTodayTranscript(): Promise<TranscriptEntry[]>;
  // mensagens que a pessoa mandou desde um instante (limite de uso)
  countUserMessagesSince(iso: string): Promise<number>;
  // falar com uma pessoa (F3): null no modo de demonstração
  openSupportTicket(message: string, channel: "web" | "whatsapp" | "voice"): Promise<{ protocol: string; dueAt: string } | null>;
  listSupportTickets(): Promise<SupportTicket[]>;
  // um turno do assistente por vez na conversa de hoje (mensagens que chegam juntas esperam a vez)
  withTurn<T>(fn: () => Promise<T>): Promise<T>;

  // finanças (M3)
  listCards(): Promise<CreditCard[]>;
  listRecurrences(): Promise<Recurrence[]>;
  setRecurrenceActive(id: string, active: boolean): Promise<boolean>;
  listInstallments(): Promise<InstallmentPurchase[]>;

  // organização (M3)
  listProjects(): Promise<Project[]>;
  setMilestoneDone(projectId: string, milestoneId: string, done: boolean): Promise<boolean>;
  listGoals(): Promise<Goal[]>;
  addGoalProgress(id: string, delta: number): Promise<Goal | null>;
  listNotes(): Promise<Note[]>;
  createNote(input: Pick<Note, "title" | "body" | "notebook" | "kind">): Promise<Note>;
  updateNote(id: string, patch: Partial<Pick<Note, "title" | "body" | "pinned" | "notebook">>): Promise<Note | null>;
  listAutomations(): Promise<Automation[]>;
  setAutomationActive(id: string, active: boolean): Promise<boolean>;
  listNotices(): Promise<Notice[]>;
  markNoticesRead(ids: string[] | "all"): Promise<void>;
  listEvents(): Promise<CalendarEvent[]>;
  listFocusSessions(): Promise<FocusSession[]>;
  saveFocusSession(input: Omit<FocusSession, "id">): Promise<FocusSession>;

  // saúde (M4)
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
