import { getStore } from "@/lib/data";

// GET /api/transactions: extrato com categorias e contas para exibir
export async function GET() {
  const store = getStore();
  const [transactions, categories, accounts] = await Promise.all([
    store.listTransactions(), store.listCategories(), store.listAccounts(),
  ]);
  return Response.json({ transactions, categories, accounts, timezone: store.timezone() });
}
