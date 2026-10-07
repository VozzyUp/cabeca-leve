import type { DataStore } from "@/lib/data/store";
import type { ActionCardData } from "@/lib/data/types";
import { parseMessage } from "./rule-parser";
import { createReminder, recordTransaction } from "./tools";

export type AssistantReply = { text: string; cards: ActionCardData[] };

// Contrato do assistente. Hoje: regras simples. No /replica-backend: Claude Opus 5.5
// com as mesmas ferramentas (tools.ts), sem mudar a rota nem as telas.
export async function handleMessage(store: DataStore, text: string, now = new Date()): Promise<AssistantReply> {
  const intents = parseMessage(text, now, store.timezone());
  if (intents.length === 0) {
    return {
      cards: [],
      text: "Ainda não consegui entender esse pedido. Por enquanto eu anoto gastos e lembretes, por exemplo: " +
        "“gastei 35 na padaria” ou “me lembra de pagar a luz amanhã às 9h”.",
    };
  }
  const cards: ActionCardData[] = [];
  for (const it of intents) {
    cards.push(it.kind === "reminder"
      ? await createReminder(store, { title: it.title, at: it.at }, now)
      : await recordTransaction(store, it, now));
  }
  const reminders = cards.filter((c) => c.kind === "reminder").length;
  const money = cards.length - reminders;
  const parts = [
    money ? (money === 1 ? "o lançamento" : `${money} lançamentos`) : "",
    reminders ? (reminders === 1 ? "o lembrete" : `${reminders} lembretes`) : "",
  ].filter(Boolean);
  return { cards, text: `Feito: salvei ${parts.join(" e ")}. Se algo saiu errado, é só desfazer no card.` };
}
