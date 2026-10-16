import type { ActionCardData } from "@/lib/data/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { getStore } from "@/lib/data";
import { formatReply } from "./inbound";
import { noticeNumbers } from "./link";
import { whatsapp } from "./provider";

// Espelho no WhatsApp (chave em Configurar assistente, desligada por padrão): o que a pessoa conversa no APP também vai
// para o WhatsApp dela, a pergunta e a resposta, para as duas telas ficarem iguais. O WhatsApp não aceita mensagem "da
// pessoa" escrita por nós, então tudo sai como mensagem do assistente, com a pergunta citada em cima.
// Vai só para os números da conta que recebem avisos. Na API oficial da Meta, fora da janela de 24 h um envio exigiria
// modelo pago: nesse caso o espelho pula o número (nunca gasta modelo com isso).

const DAY_MS = 24 * 3_600_000;
const MAX = 3800;  // o WhatsApp aceita 4096 caracteres por mensagem

export function mirrorText(userText: string, replyText: string, cards: ActionCardData[]) {
  const text = `💬 *No app, você:*\n${userText.trim()}\n\n🤖 ${formatReply(replyText, cards)}`;
  return text.length > MAX ? `${text.slice(0, MAX - 1)}…` : text;
}

// Manda a troca para os números da conta (separado do mirrorExchange para dar para testar sem sessão)
export async function mirrorToNumbers(userId: string, userText: string, reply: { text: string; cards: ActionCardData[] }, now = Date.now()) {
  const wa = whatsapp();
  if (!wa) return 0;
  const text = mirrorText(userText, reply.text, reply.cards);
  let sent = 0;
  for (const n of await noticeNumbers(userId)) {
    if (wa.name === "meta" && !(n.lastInbound && now - n.lastInbound.getTime() < DAY_MS)) continue;
    try { await wa.sendText(n.number, text); sent++; }
    catch (error) { console.error("espelho no WhatsApp não enviado", (error as Error).message); }
  }
  return sent;
}

export async function mirrorExchange(opts: { userText: string; reply: { text: string; cards: ActionCardData[] } }) {
  if (!isSupabaseConfigured()) return;
  try {
    const user = await currentUser();
    if (!user) return;
    const settings = await (await getStore({ allowLocked: true })).getSettings();
    if (!settings.mirrorWhatsapp) return;
    await mirrorToNumbers(user.id, opts.userText, opts.reply);
  } catch (error) {
    console.error("espelho no WhatsApp", (error as Error).message);
  }
}
