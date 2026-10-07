import { z } from "zod";
import { handleMessage } from "@/lib/assistant";
import { getStore } from "@/lib/data";

const Body = z.object({
  clientMessageId: z.string().min(1).max(100),
  text: z.string().trim().min(1, "Mensagem vazia").max(4000, "Mensagem longa demais"),
});

// POST /api/chat: recebe a mensagem, roda o assistente e devolve as duas mensagens novas.
// (Streaming entra junto com o Claude no /replica-backend.)
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido" }, { status: 400 });
  }
  const store = await getStore();
  const userMessage = await store.appendMessage({ role: "user", text: parsed.data.text, cards: [] });
  const reply = await handleMessage(store, parsed.data.text);
  const assistantMessage = await store.appendMessage({ role: "assistant", text: reply.text, cards: reply.cards });
  return Response.json({ messages: [userMessage, assistantMessage] });
}
