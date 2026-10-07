import type {
  Account, ActionRecord, Automation, BodyMeasurement, CalendarEvent, Category, ChatMessage, CreditCard, FocusSession, Goal,
  Habit, HabitLog, InstallmentPurchase, Meal, MealLog, Note, Notice, Project, Recurrence, Reminder, Settings, Task,
  Transaction, Workout, WorkoutLog,
} from "./types";

// Mensagem a gravar. `content` são os blocos exatos da API (reenviados byte a byte ao modelo);
// `visible: false` guarda passos internos do agente (chamadas e resultados de ferramenta).
export type AppendMessage = Omit<ChatMessage, "id" | "createdAt"> & {
  content?: unknown;
  visible?: boolean;
  channel?: "web" | "whatsapp" | "telegram" | "voice" | "job";
  clientMessageId?: string;
  externalMessageId?: string;
  usage?: { model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number };
};

// Contrato da camada de dados. Duas implementações: supabase-store (produção) e
// fake-store (modo de demonstração, sem Supabase). As telas não sabem qual está por trás.
export interface DataStore {
  timezone(): string;
  listReminders(): Promise<Reminder[]>;
  createReminder(input: { title: string; nextFireAt: string; channels?: Reminder["channels"] }): Promise<Reminder>;
  updateReminder(id: string, patch: Partial<Pick<Reminder, "status" | "lastFiredAt" | "nextFireAt" | "title">>): Promise<Reminder | null>;
  listTasks(): Promise<Task[]>;
  createTask(input: { title: string; dueOn: string | null; priority?: Task["priority"] }): Promise<Task>;
  updateTask(id: string, patch: Partial<Pick<Task, "title" | "dueOn" | "priority" | "status">>): Promise<Task | null>;
  listHabits(): Promise<Habit[]>;
  createHabit(input: { name: string; weekdays?: number[]; time?: string | null }): Promise<Habit>;
  listHabitLogs(): Promise<HabitLog[]>;
  setHabitDone(habitId: string, day: string, done: boolean): Promise<boolean>;
  listTransactions(): Promise<Transaction[]>;
  createTransaction(input: Omit<Transaction, "id" | "createdAt">): Promise<Transaction>;
  listCategories(): Promise<Category[]>;
  listAccounts(): Promise<Array<Account & { balanceCents: number }>>;
  recordAction(entity: ActionRecord["entity"], entityId: string): Promise<ActionRecord>;
  undoAction(id: string): Promise<{ ok: true } | { ok: false; reason: "not_found" | "already_undone" }>;
  listMessages(): Promise<ChatMessage[]>;
  appendMessage(msg: AppendMessage): Promise<ChatMessage>;
  markCardsUndone(actionId: string): Promise<void>;

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
