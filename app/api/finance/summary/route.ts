import { getStore } from "@/lib/data";
import { financeSummary } from "@/lib/domain/finance";
import { localDate } from "@/lib/time";

// GET /api/finance/summary?month=AAAA-MM (padrão: mês atual)
export async function GET(request: Request) {
  const store = await getStore();
  const today = localDate(new Date(), store.timezone());
  const month = new URL(request.url).searchParams.get("month") ?? today.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return Response.json({ error: "Mês inválido" }, { status: 400 });
  const [transactions, categories, accounts] = await Promise.all([store.listTransactions(), store.listCategories(), store.listAccounts()]);
  return Response.json({
    ...financeSummary(transactions, categories, month, today),
    balanceCents: accounts.reduce((s, a) => s + a.balanceCents, 0),
    today,
  });
}
