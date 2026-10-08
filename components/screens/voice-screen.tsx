"use client";
import { Mic, MicOff, Square, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { api } from "@/lib/api";
import { getRecognitionCtor as getCtor, noSubscribe as subscribe, speechSupported, type Recognition } from "@/lib/speech";

type Phase = "idle" | "listening" | "thinking" | "speaking" | "error";
type Turn = { role: "user" | "assistant"; text: string };

const STATUS: Record<Phase, string> = {
  idle: "Toque para falar",
  listening: "Ouvindo…",
  thinking: "Pensando…",
  speaking: "Respondendo…",
  error: "Toque para tentar de novo",
};

// S03: falar com o assistente e ouvir a resposta. Fala vira texto no navegador, vai para a mesma
// rota da conversa escrita (os itens criados aparecem nas telas) e a resposta é lida em voz alta.
// No /replica-backend, a transcrição passa para o servidor (funciona em qualquer navegador).
export function VoiceScreen() {
  const supported = useSyncExternalStore(subscribe, speechSupported, () => true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const heard = useRef("");

  async function answer(text: string) {
    setPhase("thinking");
    try {
      const { messages } = await api.sendMessage(crypto.randomUUID(), text);
      const reply = [...messages].reverse().find((m) => m.role === "assistant")?.text ?? "Feito.";
      setTurns((t) => [...t, { role: "assistant", text: reply }]);
      if (!("speechSynthesis" in window)) { setPhase("idle"); return; }
      const u = new SpeechSynthesisUtterance(reply);
      u.lang = "pt-BR";
      u.onend = () => setPhase("idle");
      u.onerror = () => setPhase("idle");
      setPhase("speaking");
      speechSynthesis.speak(u);
    } catch {
      setError("Não deu para falar com o assistente. Confira a conexão.");
      setPhase("error");
    }
  }

  function listen() {
    const Ctor = getCtor();
    if (!Ctor) return;
    speechSynthesis?.cancel();
    setError(null);
    heard.current = "";
    const r = new Ctor();
    r.lang = "pt-BR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const all = Array.from(e.results);
      heard.current = all.filter((x) => x.isFinal).map((x) => x[0].transcript).join(" ").trim();
      setInterim(all.map((x) => x[0].transcript).join(" "));
    };
    r.onerror = (e) => {
      setError(e.error === "not-allowed" ? "O navegador bloqueou o microfone. Libere o acesso nas permissões do site."
        : e.error === "no-speech" ? "Não ouvi nada. Tente falar mais perto do microfone." : "O reconhecimento de voz falhou. Tente de novo.");
      setPhase("error");
    };
    r.onend = () => {
      setInterim("");
      const text = heard.current;
      if (text) { setTurns((t) => [...t, { role: "user", text }]); void answer(text); }
      else setPhase((p) => (p === "listening" ? "idle" : p));
    };
    rec.current = r;
    setPhase("listening");
    r.start();
  }

  function stop() {
    if (phase === "listening") rec.current?.stop();
    if (phase === "speaking") { speechSynthesis.cancel(); setPhase("idle"); }
  }

  const busy = phase === "listening" || phase === "speaking";
  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-[34px]">Conversa por voz</h1>
        </div>
        <Link href="/conversa" aria-label="Voltar para a conversa escrita" className="flex size-10 items-center justify-center rounded-full text-body hover:bg-surface-2"><X className="size-5" /></Link>
      </header>

      {!supported ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <MicOff aria-hidden className="size-10 text-muted" />
          <p className="font-semibold text-text">Este navegador não reconhece voz</p>
          <p className="max-w-sm text-sm text-muted">Use o Chrome, o Edge ou o Safari, ou mande um áudio pelo WhatsApp.</p>
          <Link href="/conversa" className="text-sm font-medium text-accent hover:underline">Escrever na conversa</Link>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <ol aria-label="O que foi dito" className="flex w-full max-w-xl flex-col gap-3">
            {turns.slice(-4).map((t, i) => (
              <li key={i} className={cn("text-sm", t.role === "user" ? "self-end rounded-lg bg-surface-2 px-3 py-2 text-text" : "text-body")}>
                <span className="sr-only">{t.role === "user" ? "Você: " : "Assistente: "}</span>{t.text}
              </li>
            ))}
            {interim && <li className="self-end text-sm italic text-muted">{interim}</li>}
          </ol>
          <button type="button" onClick={busy ? stop : listen} disabled={phase === "thinking"}
            aria-label={busy ? "Parar" : "Falar com o assistente"}
            className={cn("relative flex size-28 items-center justify-center rounded-full transition-colors disabled:opacity-60",
              phase === "listening" ? "bg-accent text-on-accent" : "bg-surface-2 text-text hover:bg-surface-3")}>
            {phase === "listening" && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-accent opacity-30" />}
            {busy ? <Square className="size-9" /> : <Mic className="size-10" />}
          </button>
          <p role="status" className="text-sm text-body">{STATUS[phase]}</p>
          {error && <p role="alert" className="max-w-sm text-center text-sm text-danger">{error}</p>}
          {turns.length > 0 && phase === "idle" && <Button variant="ghost" size="sm" onClick={() => setTurns([])}>Limpar</Button>}
        </div>
      )}
    </div>
  );
}
