import { recordStatus } from "@/lib/diagnostics";
import { verifyQStash } from "@/lib/queue";
import { processInbound } from "@/lib/whatsapp/inbound";
import type { Inbound } from "@/lib/whatsapp/provider";

// Fila (QStash): processa uma mensagem recebida pelo WhatsApp. Erro devolve 500 para o
// QStash tentar de novo; a mensagem repetida não roda duas vezes (id externo único).
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await verifyQStash(request, rawBody))) {
    await recordStatus("whatsapp_job", "Fila recusada: a assinatura do QStash não confere (conferir QSTASH_CURRENT_SIGNING_KEY e QSTASH_NEXT_SIGNING_KEY)", false);
    return new Response("forbidden", { status: 401 });
  }
  const msg = JSON.parse(rawBody) as Inbound;
  try {
    await processInbound({ ...msg, at: new Date(msg.at) });
  } catch (error) {
    await recordStatus("whatsapp_job", "A mensagem chegou da fila, mas deu erro ao processar", false, (error as Error).message);
    throw error;
  }
  await recordStatus("whatsapp_job", "Mensagem processada", true);
  return Response.json({ ok: true });
}
