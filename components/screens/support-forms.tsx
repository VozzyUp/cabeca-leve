"use client";
import { useId, useState, useTransition } from "react";
import { answerSupport, openSupport } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function TextArea({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string | null }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-body">{label}</label>
      <textarea id={id} rows={4} value={value} onChange={(e) => onChange(e.target.value)} maxLength={4000}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        className="rounded-md border border-border-input bg-bg px-3 py-2 text-sm text-text placeholder:text-muted" />
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function SupportForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ protocol: string; dueAt: string } | null>(null);
  const [pending, start] = useTransition();
  if (done) {
    return (
      <Card role="status" className="flex flex-col gap-2">
        <p className="text-base font-semibold text-text">Chamado aberto: <span className="font-mono">{done.protocol}</span></p>
        <p className="text-sm text-body">
          Uma pessoa do time responde até {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(done.dueAt))}.
          A resposta chega aqui, no WhatsApp vinculado e por e-mail.
        </p>
        <Button variant="secondary" size="sm" className="w-fit" onClick={() => { setDone(null); setMessage(""); }}>Abrir outro</Button>
      </Card>
    );
  }
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      if (message.trim().length < 5) { setError("Conte um pouco mais sobre o que aconteceu."); return; }
      setError(null);
      start(async () => {
        try {
          const t = await openSupport(message);
          if (t) setDone(t); else setError("Não deu para abrir o chamado agora.");
        } catch { setError("Não deu para abrir o chamado. Tente de novo."); }
      });
    }}>
      <TextArea label="O que aconteceu?" value={message} onChange={setMessage} error={error} />
      <Button type="submit" loading={pending} className="w-fit">Chamar uma pessoa</Button>
    </form>
  );
}

export function AnswerForm({ ticketId, protocol }: { ticketId: string; protocol: string }) {
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => {
      e.preventDefault();
      if (!reply.trim()) { setError("Escreva a resposta."); return; }
      start(async () => {
        try { await answerSupport(ticketId, reply); } catch { setError("Não deu para enviar. Tente de novo."); }
      });
    }}>
      <TextArea label={`Resposta para ${protocol}`} value={reply} onChange={setReply} error={error} />
      <Button type="submit" size="sm" loading={pending} className="w-fit">Responder e avisar</Button>
    </form>
  );
}
