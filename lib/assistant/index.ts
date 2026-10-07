import type { DataStore } from "@/lib/data/store";
import type { ActionCardData } from "@/lib/data/types";
import { parseMessage } from "./rule-parser";
import { createHabit, createReminder, createTask, recordTransaction } from "./tools";

export type AssistantReply = { text: string; cards: ActionCardData[] };

// Contrato do assistente. Hoje: regras simples. No /replica-backend: Claude Opus 5.5
// com as mesmas ferramentas (tools.ts), sem mudar a rota nem as telas.
export async function handleMessage(store: DataStore, text: string, now = new Date()): Promise<AssistantReply> {
  const intents = parseMessage(text, now, store.timezone());
  if (intents.length === 0) {
    return {
      cards: [],
      text: "Ainda não consegui entender esse pedido. Por enquanto eu anoto gastos e lembretes, por exemplo: " +
        "“gastei 35 na padaria”, “me lembra de pagar a luz amanhã às 9h”, “cria uma tarefa de enviar o relatório até sexta” " +
        "ou “quero meditar todo dia às 7h”.",
    };
  }
  const cards: ActionCardData[] = [];
  for (const it of intents) {
    if (it.kind === "reminder") cards.push(await createReminder(store, { title: it.title, at: it.at }, now));
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
  return { cards, text: `Feito: salvei ${list}. Se algo saiu errado, é só desfazer no card.` };
}
