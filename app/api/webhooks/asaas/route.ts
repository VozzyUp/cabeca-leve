import { handleAsaasEvent, verifyAsaasWebhook } from "@/lib/billing/asaas";

// Eventos de cobrança da Asaas. Autenticação: token do webhook no cabeçalho asaas-access-token.
// Responde 200 também para repetidos (a Asaas reenvia até receber 200).
export async function POST(request: Request) {
  if (!verifyAsaasWebhook(request.headers)) return new Response("forbidden", { status: 401 });
  const event = await request.json().catch(() => null);
  if (!event?.id || !event?.event) return new Response("bad request", { status: 400 });
  const result = await handleAsaasEvent(event);
  return Response.json({ ok: true, result });
}
