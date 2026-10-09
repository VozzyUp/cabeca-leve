import { getStore } from "@/lib/data";
import { toResolve } from "@/lib/domain/resolve";
import { budgetStatus, financeSummary } from "@/lib/domain/finance";
import { localDate } from "@/lib/time";

// GET /api/finance/summary?month=AAAA-MM (padrão: mês atual)
export async function GET(request: Request) {
  const store = await getStore();
  const today = localDate(new Date(), store.timezone());
  const month = new URL(request.url).searchParams.get("month") ?? today.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return Response.json({ error: "Mês inválido" }, { status: 400 });
  const [transactions, categories, accounts, budgets, recurrences] = await Promise.all([store.listTransactions(), store.listCategories(), store.listAccounts(), store.listBudgets(), store.listRecurrences()]);
  return Response.json({
    ...financeSummary(transactions, categories, month, today),
    budgets: budgetStatus(transactions, categories, budgets, month),
    expenseCategories: categories.filter((c) => c.kind === "expense").map((c) => ({ id: c.id, name: c.name, parentId: c.parentId ?? null })),
    toResolve: toResolve(recurrences, transactions, today),
    balanceCents: accounts.reduce((s, a) => s + a.balanceCents, 0),
    today,
  });
}
