import { attemptStatus } from "@/lib/billing/asaas";
import { currentUser } from "@/lib/supabase/server";

// GET /api/billing/attempt?id=: a tela de pagamento pergunta até o Pix ou o boleto ser confirmado (ou falhar)
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return Response.json({ error: "bad request" }, { status: 400 });
  const attempt = await attemptStatus(user.id, id);
  if (!attempt) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ status: attempt.status, failure: attempt.failure });
}
