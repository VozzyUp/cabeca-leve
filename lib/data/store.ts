import type { Account, ActionRecord, Category, ChatMessage, Habit, HabitLog, Reminder, Task, Transaction } from "./types";

// Contrato da camada de dados. Hoje: fake-store (memória). No /replica-backend:
// implementação Supabase com as mesmas assinaturas, sem mudar nenhuma tela.
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
  appendMessage(msg: Omit<ChatMessage, "id" | "createdAt">): Promise<ChatMessage>;
  markCardsUndone(actionId: string): Promise<void>;
}
