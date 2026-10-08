import { z } from "zod";
import { getStore } from "@/lib/data";

const Body = z.object({
  categoryId: z.uuid().or(z.string().min(1).max(64)),  // no modo de demonstração os ids não são uuid
  amountCents: z.number().int().positive().max(100_000_000).nullable(),
});

// POST /api/budgets: define (ou tira, com null) o teto do mês de uma categoria de gasto
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Teto inválido" }, { status: 400 });
  const ok = await (await getStore()).setBudget(parsed.data.categoryId, parsed.data.amountCents);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Categoria não encontrada" }, { status: 404 });
}
