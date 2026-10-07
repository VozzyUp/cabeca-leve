import type { Account, Category, ChatMessage, Reminder, Transaction } from "@/lib/data/types";

// Chamadas das telas para as rotas de API (camada "service")
async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Algo deu errado. Tente de novo.");
  return body as T;
}

export const api = {
  chatHistory: () => call<{ messages: ChatMessage[] }>("/api/chat/history"),
  sendMessage: (clientMessageId: string, text: string) =>
    call<{ messages: ChatMessage[] }>("/api/chat", { method: "POST", body: JSON.stringify({ clientMessageId, text }) }),
  undo: (actionId: string) => call<{ ok: true }>(`/api/actions/${actionId}/undo`, { method: "POST" }),
  reminders: () => call<{ reminders: Reminder[]; timezone: string }>("/api/reminders"),
  updateReminder: (id: string, patch: Partial<Pick<Reminder, "status" | "lastFiredAt">>) =>
    call<{ reminder: Reminder }>(`/api/reminders/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  transactions: () => call<{
    transactions: Transaction[]; categories: Category[]; accounts: Array<Account & { balanceCents: number }>; timezone: string;
  }>("/api/transactions"),
};
