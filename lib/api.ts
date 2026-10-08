import type { Account, Category, ChatMessage, Habit, Reminder, Task, Transaction } from "@/lib/data/types";
import type { DayItem } from "@/lib/domain/day";
import type { BudgetStatus, FinanceSummary } from "@/lib/domain/finance";
import type { HabitStats } from "@/lib/domain/habits";

// Chamadas das telas para as rotas de API (camada "service")
async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  // sessão vencida com a tela aberta: leva para o login e volta para cá depois
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/entrar")) {
    // recarga inteira de propósito: limpa o estado da tela da sessão que acabou
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/entrar?voltar=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
  if (!res.ok) throw new Error(body.error ?? "Algo deu errado. Tente de novo.");
  return body as T;
}

export const api = {
  chatHistory: () => call<{ messages: ChatMessage[] }>("/api/chat/history"),
  sendMessage: (clientMessageId: string, text: string) =>
    call<{ messages: ChatMessage[] }>("/api/chat", { method: "POST", body: JSON.stringify({ clientMessageId, text }) }),
  undo: (actionId: string) => call<{ ok: true }>(`/api/actions/${actionId}/undo`, { method: "POST" }),
  reminders: () => call<{ reminders: Reminder[]; timezone: string }>("/api/reminders"),
  createReminder: (input: { title: string; nextFireAt: string; recurrenceRule: string | null }) =>
    call<{ reminder: Reminder }>("/api/reminders", { method: "POST", body: JSON.stringify(input) }),
  updateReminder: (id: string, patch: Partial<Pick<Reminder, "status" | "lastFiredAt" | "nextFireAt" | "title" | "recurrenceRule">>) =>
    call<{ reminder: Reminder }>(`/api/reminders/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteReminder: (id: string) => call<{ ok: true }>(`/api/reminders/${id}`, { method: "DELETE" }),
  transactions: () => call<{
    transactions: Transaction[]; categories: Category[]; accounts: Array<Account & { balanceCents: number }>; timezone: string;
  }>("/api/transactions"),
  tasks: () => call<{ tasks: Task[]; today: string }>("/api/tasks"),
  createTask: (input: { title: string; dueOn: string | null; priority: Task["priority"]; notes?: string | null; recurrenceRule?: string | null }) =>
    call<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify(input) }),
  updateTask: (id: string, patch: Partial<Pick<Task, "status" | "title" | "dueOn" | "priority" | "notes" | "recurrenceRule">>) =>
    call<{ task: Task }>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTask: (id: string) => call<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),
  habits: () => call<{ today: string; habits: Array<Habit & { stats: HabitStats }> }>("/api/habits"),
  createHabit: (input: { name: string; weekdays: number[]; time: string | null }) =>
    call<{ habit: Habit }>("/api/habits", { method: "POST", body: JSON.stringify(input) }),
  setHabitDone: (id: string, day: string, done: boolean) =>
    call<{ ok: true }>(`/api/habits/${id}/logs/${day}`, { method: done ? "PUT" : "DELETE" }),
  financeSummary: (month?: string) =>
    call<FinanceSummary & { balanceCents: number; today: string; budgets: BudgetStatus[]; expenseCategories: Array<{ id: string; name: string; parentId: string | null }> }>(`/api/finance/summary${month ? `?month=${month}` : ""}`),
  setBudget: (categoryId: string, amountCents: number | null) =>
    call<{ ok: true }>("/api/budgets", { method: "POST", body: JSON.stringify({ categoryId, amountCents }) }),
  day: () => call<{ today: string; timezone: string; items: DayItem[]; next: DayItem | null }>("/api/day"),
};
