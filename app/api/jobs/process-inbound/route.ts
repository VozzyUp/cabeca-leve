import { verifyQStash } from "@/lib/queue";
import { processInbound } from "@/lib/whatsapp/inbound";
import type { Inbound } from "@/lib/whatsapp/provider";

// Fila (QStash): processa uma mensagem recebida pelo WhatsApp. Erro devolve 500 para o
// QStash tentar de novo; a mensagem repetida não roda duas vezes (id externo único).
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await verifyQStash(request, rawBody))) return new Response("forbidden", { status: 401 });
  const msg = JSON.parse(rawBody) as Inbound;
  await processInbound({ ...msg, at: new Date(msg.at) });
  return Response.json({ ok: true });
}
