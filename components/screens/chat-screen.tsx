"use client";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionCard } from "@/components/ui/action-card";
import { Button } from "@/components/ui/button";
import { Composer } from "@/components/ui/composer";
import { Message, Steps } from "@/components/ui/message";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/data/types";
import { useOnline, useResource } from "@/lib/hooks";

type Local = ChatMessage & { status?: "sending" | "error" };

const CARD = {
  reminder: { kind: "Lembrete", open: "Ver nos lembretes" },
  transaction: { kind: "Lançamento", open: "Ver no extrato" },
  task: { kind: "Tarefa", open: "Ver nas tarefas" },
  habit: { kind: "Hábito", open: "Ver nos hábitos" },
} as const;

const SUGGESTIONS = [
  "Gastei 35 na padaria e me lembra do mercado às 18h",
  "Me lembra de pagar a luz amanhã às 9h",
  "Cria uma tarefa de enviar o relatório até sexta",
  "Quero ler 20 minutos todo dia às 21h",
];

const loadHistory = async (): Promise<Local[]> => (await api.chatHistory()).messages;

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

// S01 + S02: início da conversa e a conversa em si
export function ChatScreen() {
  const router = useRouter();
  const history = useResource(loadHistory);
  const messages = history.data;
  const setMessages = (fn: (m: Local[] | null) => Local[]) => history.setData(fn);
  const loadError = history.error;
  const load = history.reload;
  const [sending, setSending] = useState(false);
  const offline = !useOnline();
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages?.length, sending]);

  async function send(text: string, retryId?: string) {
    const clientId = retryId ?? crypto.randomUUID();
    const temp: Local = { id: clientId, role: "user", text, cards: [], createdAt: new Date().toISOString(), status: "sending" };
    setMessages((m) => [...(m ?? []).filter((x) => x.id !== clientId), temp]);
    setSending(true);
    try {
      const { messages: fresh } = await api.sendMessage(clientId, text);
      setMessages((m) => [...(m ?? []).filter((x) => x.id !== clientId), ...fresh]);
    } catch {
      setMessages((m) => (m ?? []).map((x) => (x.id === clientId ? { ...x, status: "error" } : x)));
    } finally {
      setSending(false);
    }
  }

  async function undo(actionId: string) {
    try {
      await api.undo(actionId);
      setMessages((m) => (m ?? []).map((msg) => ({
        ...msg, cards: msg.cards.map((c) => (c.actionId === actionId ? { ...c, undone: true } : c)),
      })));
    } catch { /* já desfeito ou inexistente: o card fica como está */ }
  }

  const empty = messages && messages.length === 0;
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col">
      <h1 className="sr-only">Conversa</h1>
      <div role="log" aria-live="polite" aria-label="Mensagens" className="flex flex-1 flex-col gap-4 pb-4">
        {loadError && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-md border border-danger px-4 py-3 text-sm">
            Não deu para carregar a conversa.
            <Button size="sm" variant="secondary" onClick={load}>Tentar de novo</Button>
          </div>
        )}
        {!messages && !loadError && (
          <div className="flex flex-col gap-4" aria-label="Carregando conversa">
            <Skeleton className="ml-auto h-10 w-2/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-6 w-1/2" />
          </div>
        )}
        {empty && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
            <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-body">
              <MessageCircle className="size-7" />
            </span>
            <div>
              <p className="text-label text-muted">{greeting()}</p>
              <p className="mt-1 text-xl font-semibold">O que você quer tirar da cabeça?</p>
              <Link href="/briefing" className="mt-2 inline-block text-sm font-medium text-info hover:underline">Ver o resumo do dia</Link>
            </div>
            <ul className="flex w-full flex-col gap-2" aria-label="Exemplos">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => send(s)} disabled={sending || offline}
                    className="w-full rounded-md border border-border bg-surface px-4 py-3 text-left text-sm text-body hover:bg-surface-2">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages?.map((m) => (
          <div key={m.id} className="flex flex-col gap-3">
            {m.role === "user" ? (
              m.status === "error" ? (
                <button type="button" onClick={() => send(m.text, m.id)} className="text-right" aria-label={`Reenviar: ${m.text}`}>
                  <Message from="user" status="error">{m.text}</Message>
                </button>
              ) : <Message from="user" status={m.status}>{m.text}</Message>
            ) : (
              <>
                {m.cards.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {m.cards.map((c) => (
                      <ActionCard key={c.actionId} kind={CARD[c.kind].kind} title={c.title}
                        value={c.value} valueTone={c.valueTone} meta={c.meta} state={c.undone ? "undone" : "created"}
                        openLabel={CARD[c.kind].open}
                        onOpen={() => router.push(c.href)} onUndo={() => undo(c.actionId)} />
                    ))}
                  </div>
                )}
                <Message from="assistant">{m.text}</Message>
              </>
            )}
          </div>
        ))}
        {sending && <Steps steps={[{ label: "Entendendo o pedido", done: false }]} />}
        <div ref={bottom} className="scroll-mb-40 lg:scroll-mb-28" />
      </div>
      <div className="sticky bottom-20 -mx-4 bg-bg px-4 pb-4 pt-2 lg:bottom-0 lg:mx-0 lg:px-0 lg:pb-6">
        <Composer onSend={(t) => send(t)} sending={sending} offline={offline} onVoiceMode={() => router.push("/conversa/voz")} />
      </div>
    </div>
  );
}
