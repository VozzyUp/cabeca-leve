import type { Account, ActionRecord, Category, ChatMessage, Reminder, Transaction } from "./types";

// Contrato da camada de dados. Hoje: fake-store (memória). No /replica-backend:
// implementação Supabase com as mesmas assinaturas, sem mudar nenhuma tela.
export interface DataStore {
  timezone(): string;
  listReminders(): Promise<Reminder[]>;
  createReminder(input: { title: string; nextFireAt: string; channels?: Reminder["channels"] }): Promise<Reminder>;
  updateReminder(id: string, patch: Partial<Pick<Reminder, "status" | "lastFiredAt" | "nextFireAt" | "title">>): Promise<Reminder | null>;
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
