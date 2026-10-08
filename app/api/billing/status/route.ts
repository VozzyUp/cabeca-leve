import { getStore } from "@/lib/data";

// GET /api/billing/status: a tela de "obrigado" pergunta até a Asaas confirmar o pagamento
export async function GET() {
  const s = await (await getStore()).getSettings();
  const active = (s.plan === "monthly" || s.plan === "yearly") && !s.billing?.confirming;
  return Response.json({ plan: s.plan, active, confirming: !!s.billing?.confirming });
}
