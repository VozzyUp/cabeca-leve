import { respond } from "@/lib/assistant";
import { agentEnabled } from "@/lib/assistant/agent";
import { stageOriginal } from "@/lib/documents";
import { getStore } from "@/lib/data";
import { ImageError, MAX_IMAGE_BYTES, normalizeImage } from "@/lib/image";

// POST /api/chat/image?id=<clientMessageId>&caption=<legenda>: a foto vai no corpo (Content-Type: image/*).
// Reduz a foto, manda para o assistente e devolve o histórico atualizado, como o /api/chat.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const clientMessageId = url.searchParams.get("id") ?? "";
  const caption = (url.searchParams.get("caption") ?? "").trim().slice(0, 500);
  if (!clientMessageId || clientMessageId.length > 100) return Response.json({ error: "Pedido inválido" }, { status: 400 });
  if (!(request.headers.get("content-type") ?? "").startsWith("image/")) return Response.json({ error: "Envie uma imagem" }, { status: 415 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) return Response.json({ error: "Foto grande demais (até 12 MB)." }, { status: 413 });

  let image;
  const original = Buffer.from(await request.arrayBuffer());
  try { image = await normalizeImage(original); }
  catch (error) {
    if (error instanceof ImageError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const store = await getStore();
  // o original fica 24 h para "guarda na pasta Convênio" na mensagem seguinte
  const files = agentEnabled() ? await stageOriginal(store, original, request.headers.get("content-type") ?? "image/jpeg", "foto.jpg") : undefined;
  try {
    const result = await respond(store, caption, { channel: "web", clientMessageId, images: [image], ...(files ? { files } : {}) });
    if (result.stored === false) {
      // limite de uso: nada foi gravado, mas a pessoa precisa ver a mensagem e o motivo
      const createdAt = new Date().toISOString();
      return Response.json({ messages: [
        { id: clientMessageId, role: "user", text: caption ? `📷 ${caption}` : "📷 Foto", cards: [], createdAt, local: true },
        { id: crypto.randomUUID(), role: "assistant", text: result.reply.text, cards: [], createdAt, local: true },
      ] });
    }
  } catch (error) {
    // mesma foto enviada de novo: não roda o assistente outra vez
    if (!(error instanceof Error && /client_message_id|duplicate key/.test(error.message))) throw error;
  }
  return Response.json({ messages: (await store.listMessages()).slice(-2) });
}
