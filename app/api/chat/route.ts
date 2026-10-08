import { z } from "zod";
import { respond } from "@/lib/assistant";
import { getStore } from "@/lib/data";

const Body = z.object({
  clientMessageId: z.string().min(1).max(100),
  text: z.string().trim().min(1, "Mensagem vazia").max(4000, "Mensagem longa demais"),
});

// POST /api/chat: recebe a mensagem, roda o assistente e devolve o histórico atualizado.
// clientMessageId evita processar duas vezes o mesmo envio (duplo clique, nova tentativa).
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido" }, { status: 400 });
  }
  const store = await getStore();
  try {
    const result = await respond(store, parsed.data.text, { channel: "web", clientMessageId: parsed.data.clientMessageId });
    if (result.stored === false) {
      // limite de uso: nada foi gravado, mas a pessoa precisa ver a mensagem e o motivo
      const createdAt = new Date().toISOString();
      return Response.json({ messages: [
        { id: parsed.data.clientMessageId, role: "user", text: parsed.data.text, cards: [], createdAt },
        { id: crypto.randomUUID(), role: "assistant", text: result.reply.text, cards: [], createdAt },
      ] });
    }
  } catch (error) {
    // mesma mensagem enviada de novo: não roda o assistente outra vez
    if (!(error instanceof Error && /client_message_id|duplicate key/.test(error.message))) throw error;
  }
  const all = await store.listMessages();
  return Response.json({ messages: all.slice(-2) });
}
