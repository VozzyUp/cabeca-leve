import type { DataStore } from "@/lib/data/store";
import type { ActionCardData } from "@/lib/data/types";
import { formatDayLabel, formatTime, localDate, zonedToUtc } from "@/lib/time";
import type { Button } from "./provider";

// Botões das respostas do WhatsApp. O id de cada botão diz o que fazer quando a pessoa toca:
//   u:<ação>[,<ação>]  desfazer      a:<ação>   alterar (volta para a conversa)
//   r:d|s:<lembrete>   feito, adiar  r:m10|h1|tm:<lembrete>  adiar para daqui a 10 min, 1 h ou amanhã às 9h
//   q:<texto>          resposta rápida escolhida pelo assistente (vale como se a pessoa tivesse digitado)
//   t:ok | t:no        teste de botões
// Tudo roda com o armazenamento da própria pessoa, então um id forjado só alcança o que já é dela.

export type ButtonResult = { text: string; buttons?: Button[] } | { ask: string };

const quote = (t: string) => `“${t.length > 60 ? `${t.slice(0, 59)}…` : t}”`;

// Depois de registrar algo: desfazer e alterar. Com vários itens, só desfazer tudo (até 5).
export function cardButtons(cards: ActionCardData[]): Button[] {
  const live = cards.filter((c) => !c.undone);
  if (!live.length || live.length > 5) return [];
  if (live.length === 1) return [{ id: `u:${live[0].actionId}`, title: "↩️ Desfazer" }, { id: `a:${live[0].actionId}`, title: "✏️ Alterar" }];
  return [{ id: `u:${live.map((c) => c.actionId).join(",")}`, title: "↩️ Desfazer tudo" }];
}

export const reminderButtons = (id: string): Button[] => [{ id: `r:d:${id}`, title: "✅ Feito" }, { id: `r:s:${id}`, title: "⏰ Adiar" }];
export const testButtons = (): Button[] => [{ id: "t:ok", title: "✅ Apareceu" }, { id: "t:no", title: "❌ Não entendi" }];

const snoozeButtons = (id: string): Button[] => [
  { id: `r:m10:${id}`, title: "10 minutos" }, { id: `r:h1:${id}`, title: "1 hora" }, { id: `r:tm:${id}`, title: "Amanhã às 9h" },
];

// Cada clique só vale uma vez por mensagem: o provedor pode reenviar o mesmo aviso (memória do processo, 10 min)
const seen = new Map<string, number>();
export function firstTime(key: string, now = Date.now()) {
  for (const [k, at] of seen) if (now - at > 600_000) seen.delete(k);
  if (seen.has(key)) return false;
  seen.set(key, now);
  return true;
}

export async function handleButton(store: DataStore, id: string, now = new Date()): Promise<ButtonResult> {
  const [kind, ...rest] = id.split(":");
  const payload = rest.join(":");
  const tz = store.timezone();

  if (kind === "q" && payload) return { ask: payload };
  if (kind === "a") return { ask: "Quero alterar o que você acabou de registrar." };

  if (kind === "u") {
    const results = [];
    for (const actionId of payload.split(",").filter(Boolean).slice(0, 5)) results.push(await store.undoAction(actionId));
    const done = results.filter((r) => r.ok).length;
    if (done) return { text: done > 1 ? `↩️ Pronto, desfiz os ${done} itens.` : "↩️ Pronto, desfiz." };
    return { text: results.length ? "Isso já estava desfeito." : "Esse botão não vale mais." };
  }

  if (kind === "t") {
    return { text: payload === "ok" ? "Ótimo! Os botões funcionam por aqui. 🎉" : "Tudo bem. Se os botões não aparecem ou confundem, peça a quem administra para desligar em Configuração do sistema > WhatsApp > Botões." };
  }

  if (kind === "r") {
    const [action, ...idParts] = payload.split(":");
    const reminderId = idParts.join(":");
    const reminder = (await store.listReminders()).find((r) => r.id === reminderId);
    if (!reminder) return { text: "Não achei esse lembrete. Talvez já tenha sido apagado." };

    if (action === "d") {
      if (reminder.recurrenceRule) return { text: `✅ Anotado: ${quote(reminder.title)}. O próximo já está agendado.` };
      if (reminder.status !== "active") return { text: "Esse lembrete já estava feito." };
      await store.updateReminder(reminder.id, { status: "done" });
      return { text: `✅ Feito: ${quote(reminder.title)}.` };
    }
    if (action === "s") return { text: `Adiar ${quote(reminder.title)} para quando?`, buttons: snoozeButtons(reminder.id) };

    if (action === "m10" || action === "h1" || action === "tm") {
      let target: Date;
      if (action === "tm") {
        const [y, m, d] = localDate(new Date(now.getTime() + 86_400_000), tz).split("-").map(Number);
        target = zonedToUtc(y, m, d, 9, 0, tz);
      } else target = new Date(now.getTime() + (action === "m10" ? 10 : 60) * 60_000);
      // o adiamento é um lembrete novo de uma vez só: o original (e a repetição dele) não muda de horário
      await store.createReminder({ title: reminder.title, nextFireAt: target.toISOString() });
      if (!reminder.recurrenceRule && reminder.status === "active") await store.updateReminder(reminder.id, { status: "done" });
      const day = formatDayLabel(localDate(target, tz), now, tz);
      return { text: `⏰ Adiado: ${quote(reminder.title)} para ${day}, ${formatTime(target.toISOString(), tz)}.` };
    }
  }
  return { text: "Esse botão não vale mais. Pode escrever o que precisa?" };
}
