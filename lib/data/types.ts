// Tipos de domínio compartilhados pelas telas e pela camada de dados.
// Espelham as tabelas de replica/schema.sql (só os campos que as telas usam).

export type Reminder = {
  id: string;
  title: string;
  nextFireAt: string | null;  // ISO UTC
  recurrenceRule: string | null;
  channels: Array<"push" | "whatsapp" | "telegram" | "email">;
  status: "active" | "done" | "canceled";
  lastFiredAt: string | null;
  createdAt: string;
};

export type Category = { id: string; name: string; kind: "expense" | "income" };
export type Account = { id: string; name: string; openingBalanceCents: number };

export type Transaction = {
  id: string;
  type: "expense" | "income";
  amountCents: number;        // sempre positivo; o tipo dá a direção
  occurredOn: string;         // dia local AAAA-MM-DD
  description: string;
  categoryId: string | null;
  accountId: string;
  paymentMethod: "pix" | "debit" | "credit" | "cash" | "other" | null;
  source: "manual" | "chat" | "whatsapp";
  createdAt: string;
};

// Card que o assistente devolve no chat para cada item que criou
export type ActionCardData = {
  actionId: string;
  kind: "reminder" | "transaction";
  title: string;
  value: string;
  valueTone: "neutral" | "income" | "expense";
  meta: string;
  href: string;
  undone: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards: ActionCardData[];
  createdAt: string;
};

export type ActionRecord = {
  id: string;
  entity: "reminder" | "transaction";
  entityId: string;
  operation: "create";
  undoneAt: string | null;
};
