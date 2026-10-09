import type { DataStore } from "@/lib/data/store";
import type { ActionCardData, ChatMessage } from "@/lib/data/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { agentEnabled, runAgent } from "./agent";
import { limitReply, limitsFor } from "@/lib/limits";
import { periodRange } from "@/lib/ai-costs";
import { siteUrl } from "@/lib/public-env";
import { formatDue } from "@/lib/support";
import { parseBudget, parseMessage, wantsHuman } from "./rule-parser";
import type { ChatImage } from "@/lib/image";
import { createHabit, createReminder, createTask, recordTransaction, setBudgetByName } from "./tools";

export type AssistantReply = { text: string; cards: ActionCardData[]; replies?: string[] };  // replies: respostas rápidas (botões no WhatsApp)

// Intérprete de regras: reserva para quando não há chave da Anthropic (testes e demonstração).
// O agente de verdade (agent.ts) usa as mesmas ferramentas (tools.ts).
export async function handleMessage(store: DataStore, text: string, now = new Date(), channel: "web" | "whatsapp" | "voice" = "web"): Promise<AssistantReply> {
  if (wantsHuman(text)) return { cards: [], text: await callHuman(store, text, channel) };
  const budget = parseBudget(text);
  if (budget) return { cards: [], text: (await setBudgetByName(store, budget.categoryName, budget.amountCents)).text };
  const intents = parseMessage(text, now, store.timezone());
  if (intents.length === 0) {
    return {
      cards: [],
      text: "Esse eu ainda não sei fazer. Tente assim: " +
        "“gastei 35 na padaria”, “me lembra de pagar a luz amanhã às 9h”, “cria uma tarefa de enviar o relatório até sexta” " +
        "ou “quero meditar todo dia às 7h”.",
    };
  }
  const cards: ActionCardData[] = [];
  for (const it of intents) {
    if (it.kind === "reminder") cards.push(await createReminder(store, { title: it.title, at: it.at, recurrenceRule: it.recurrenceRule }, now));
    else if (it.kind === "task") cards.push(await createTask(store, it, now));
    else if (it.kind === "habit") cards.push(await createHabit(store, it));
    else cards.push(await recordTransaction(store, it, now));
  }
  const count = (k: string) => cards.filter((c) => c.kind === k).length;
  const name = (n: number, one: string, many: string) => (n === 0 ? "" : n === 1 ? one : `${n} ${many}`);
  const parts = [
    name(count("transaction"), "o lançamento", "lançamentos"),
    name(count("reminder"), "o lembrete", "lembretes"),
    name(count("task"), "a tarefa", "tarefas"),
    name(count("habit"), "o hábito", "hábitos"),
  ].filter(Boolean);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : parts[0];
  return { cards, text: `Pronto, tirei da sua cabeça: ${list}. Errei algo? Toque em Desfazer no card.` };
}

// F3: chama uma pessoa do time e responde com o protocolo e o prazo
async function callHuman(store: DataStore, text: string, channel: "web" | "whatsapp" | "voice") {
  const t = await store.openSupportTicket(text, channel);
  return t
    ? `Chamei uma pessoa do time. Protocolo ${t.protocol}. A resposta chega aqui, no app e por e-mail até ${formatDue(t.dueAt, store.timezone())}.`
    : "No modo de demonstração não há time de suporte.";
}

// Ponto único de entrada da conversa (app, voz e WhatsApp). Com ANTHROPIC_API_KEY, o agente
// Claude; sem ela, o intérprete de regras (só para testes e demonstração).
export async function respond(store: DataStore, text: string, opts: {
  channel: "web" | "whatsapp" | "voice"; clientMessageId?: string; externalMessageId?: string; now?: Date;
  images?: ChatImage[];  // fotos desta mensagem (já reduzidas); o texto pode ser a legenda ou vazio
  sender?: string | null;  // nome do WhatsApp que mandou, quando a conta tem mais de uma pessoa
}): Promise<{ user: ChatMessage | null; reply: AssistantReply; stored?: false }> {
  if (opts.images?.length) text = text.trim() ? `📷 ${text.trim()}` : "📷 Foto";
  // teste grátis acabou e não há assinatura: guarda a mensagem e explica, sem rodar o assistente
  if (isSupabaseConfigured() && (await store.getSettings()).plan === "none") {
    const site = siteUrl();
    // mesmo sem plano, pedir uma pessoa sempre funciona (cobrança e acesso são os casos mais comuns)
    const reply = wantsHuman(text) ? { text: await callHuman(store, text, opts.channel), cards: [] } : { text: `Seu teste grátis terminou. Para continuar, escolha um plano em ${site}/planos. Tudo o que você anotou continua guardado.`, cards: [] };
    const user = await store.appendMessage({ role: "user", text, cards: [], channel: opts.channel, clientMessageId: opts.clientMessageId, externalMessageId: opts.externalMessageId });
    await store.appendMessage({ role: "assistant", text: reply.text, cards: [], channel: opts.channel });
    return { user, reply };
  }
  // mensagens que chegam juntas esperam a vez: o histórico de um turno não se mistura com o de outro
  try {
    return await store.withTurn(() => turn(store, text, opts));
  } catch (error) {
    if (!(error instanceof Error && error.message === "turno ocupado")) throw error;
    return { user: null, reply: { text: "Ainda estou terminando a resposta anterior. Mande de novo em instantes.", cards: [] }, stored: false };
  }
}

async function turn(store: DataStore, text: string, opts: {
  channel: "web" | "whatsapp" | "voice"; clientMessageId?: string; externalMessageId?: string; now?: Date; images?: ChatImage[]; sender?: string | null;
}): Promise<{ user: ChatMessage | null; reply: AssistantReply; stored?: false }> {
  // limite de uso por plano: protege o custo de IA (e o número de WhatsApp) contra abuso
  const settings = await store.getSettings();
  const limits = limitsFor(settings.plan);
  const now = new Date();
  const dayStart = periodRange("hoje", now, store.timezone()).from.toISOString();
  const [lastMinute, today, costTodayUsd] = await Promise.all([
    store.countUserMessagesSince(new Date(now.getTime() - 60_000).toISOString()),
    store.countUserMessagesSince(dayStart),
    limits.costUsdPerDay === null ? Promise.resolve(0) : store.aiCostSince(dayStart),
  ]);
  const blocked = limitReply(settings.plan, { lastMinute, today, costTodayUsd }, limits);
  if (blocked) return { user: null, reply: { text: blocked, cards: [] }, stored: false };  // não grava: a resposta volta só para quem mandou
  if (agentEnabled()) {
    const reply = await runAgent({ store, text, ...opts });
    return { user: null, reply };
  }
  const user = await store.appendMessage({ role: "user", text, cards: [], channel: opts.channel, clientMessageId: opts.clientMessageId, externalMessageId: opts.externalMessageId });
  // sem a IA ligada (demonstração e testes) não há como ler a foto
  const reply = opts.images?.length
    ? { text: "Ainda não leio fotos neste app. Escreva o que tem nela, por exemplo “gastei 45 no mercado”.", cards: [] }
    : await handleMessage(store, text, opts.now, opts.channel);
  await store.appendMessage({ role: "assistant", text: reply.text, cards: reply.cards, channel: opts.channel });
  return { user, reply };
}
