import { respond } from "@/lib/assistant";
import { storeForUser } from "@/lib/data";
import type { ActionCardData } from "@/lib/data/types";
import { getAdmin } from "@/lib/supabase/server";
import { transcribe, transcriptionEnabled } from "@/lib/transcribe";
import { findLinkByNumber, tryVerify } from "./link";
import { phoneVariants, toE164 } from "./phone";
import { cardButtons, firstTime, handleButton } from "./buttons";
import { sendReply, whatsapp, type Inbound } from "./provider";
import { siteUrl } from "@/lib/public-env";
import { ImageError, normalizeImage, type ChatImage } from "@/lib/image";

const KIND: Record<ActionCardData["kind"], string> = {
  reminder: "Lembrete", transaction: "Lançamento", task: "Tarefa", habit: "Hábito", workout: "Ficha de treino", meal: "Plano alimentar",
  project: "Projeto", goal: "Meta", automation: "Revisão agendada", recurring: "Conta fixa",
};

// No WhatsApp não há card: a resposta leva uma linha por item salvo
export function formatReply(text: string, cards: ActionCardData[]) {
  const lines = cards.flatMap((c) => [`✅ ${KIND[c.kind]}: ${c.title} · ${c.value}${c.meta ? ` · ${c.meta}` : ""}`, ...(c.alert ? [`⚠️ ${c.alert}`] : [])]);
  return [text, ...(lines.length ? ["", ...lines] : [])].join("\n");
}

const site = siteUrl;

// Processa uma mensagem recebida (roda na fila, nunca dentro do webhook)
export async function processInbound(msg: Inbound) {
  const wa = whatsapp();
  if (!wa) return;
  const found = await findLinkByNumber(msg.from);
  const userId = found?.userId ?? null;
  if (!userId) {
    const linked = msg.text ? await tryVerify(msg.from, msg.text) : null;
    await wa.sendText(msg.from, linked
      ? "Pronto! Este WhatsApp está ligado à sua conta. Agora é só mandar por aqui o que quiser tirar da cabeça: gastos, lembretes, tarefas, por texto ou áudio."
      : `Oi! Este número ainda não está ligado a uma conta do Cabeça Leve. Para usar aqui, entre em ${site()}/ajustes e toque em Vincular WhatsApp.`);
    return;
  }
  await getAdmin().from("channel_links").update({ last_inbound_at: msg.at.toISOString() })
    .eq("user_id", userId).eq("channel", "whatsapp").in("external_id", phoneVariants(msg.from).map(toE164));

  let text = msg.text;
  // toque num botão: ações simples respondem na hora; as que precisam da conversa seguem como texto digitado
  if (msg.button) {
    if (!firstTime(`btn:${msg.externalId}`)) return;
    const result = await handleButton(await storeForUser(userId), msg.button.id, msg.at);
    if (!("ask" in result)) { await sendReply(wa, msg.from, result.text, result.buttons); return; }
    text = result.ask;
  }
  if (msg.audio) {
    if (!transcriptionEnabled()) { await wa.sendText(msg.from, "Ainda não consigo ouvir áudios por aqui. Pode mandar por texto?"); return; }
    const audio = await wa.downloadAudio(msg.audio.ref);
    text = await transcribe(audio.data, audio.mimeType);
    if (!text) { await wa.sendText(msg.from, "Não consegui entender o áudio. Pode mandar de novo?"); return; }
  }
  // foto (comprovante, fatura, plano): baixa, reduz e segue junto com a legenda
  let images: ChatImage[] | undefined;
  if (msg.image) {
    try { images = [await normalizeImage((await wa.downloadImage(msg.image.ref)).data)]; }
    catch (error) {
      if (error instanceof ImageError) { await wa.sendText(msg.from, error.message); return; }
      throw error;
    }
    text = msg.image.caption ?? "";
  }
  const store = await storeForUser(userId);
  try {
    const { reply } = await respond(store, text ?? "", { channel: "whatsapp", externalMessageId: msg.externalId, now: msg.at, sender: found?.label ?? null, ...(images ? { images } : {}) });
    // o assistente pode propor respostas rápidas; senão, o que acabou de ser registrado ganha Desfazer e Alterar
    const buttons = reply.replies?.length ? reply.replies.map((r) => ({ id: `q:${r}`, title: r })) : cardButtons(reply.cards);
    await sendReply(wa, msg.from, formatReply(reply.text, reply.cards), buttons);
  } catch (error) {
    // o provedor reenviou a mesma mensagem: já foi processada
    if (error instanceof Error && /duplicate key|external_message_id/.test(error.message)) return;
    throw error;
  }
}
