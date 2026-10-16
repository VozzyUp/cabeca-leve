import { getStore } from "@/lib/data";
import { isPaidPlanId } from "@/lib/plans";

// GET /api/billing/status: a tela de "obrigado" pergunta até a Asaas confirmar o pagamento
export async function GET() {
  const s = await (await getStore({ allowLocked: true })).getSettings();
  const active = isPaidPlanId(s.plan) && !s.billing?.confirming;
  return Response.json({ plan: s.plan, active, confirming: !!s.billing?.confirming });
}
