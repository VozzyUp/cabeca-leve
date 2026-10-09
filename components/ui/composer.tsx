"use client";
import { AudioLines, Mic, Paperclip, SendHorizontal } from "lucide-react";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { getRecognitionCtor, noSubscribe, speechSupported, type Recognition } from "@/lib/speech";
import { IconButton } from "./button";
import { cn } from "./cn";

type ComposerProps = {
  onSend: (text: string) => void;
  sending?: boolean;
  offline?: boolean;
  onAttach?: () => void;
  onDictate?: () => void;
  onVoiceMode?: () => void;
};

// Campo de mensagem: texto, anexo, ditado e modo de voz. Enter envia, Shift+Enter quebra linha.
export function Composer({ onSend, sending = false, offline = false, onAttach, onDictate, onVoiceMode }: ComposerProps) {
  const [text, setText] = useState("");
  const [dictating, setDictating] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const canDictate = useSyncExternalStore(noSubscribe, () => speechSupported() || (typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices), () => false);
  const blocked = sending || offline;

  // Sem reconhecimento no navegador: grava e transcreve no servidor (Groq)
  const recorder = useRef<MediaRecorder | null>(null);
  async function recordForServer() {
    if (recorder.current) { recorder.current.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recorder.current = null;
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        try {
          const res = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
          if (res.ok) { const { text: said } = (await res.json()) as { text: string }; if (said) setText((t) => (t ? `${t} ${said}` : said)); }
        } finally { setDictating(false); }
      };
      recorder.current = rec;
      setDictating(true);
      rec.start();
    } catch { setDictating(false); }
  }

  // Ditado: o que for dito entra no campo, para revisar antes de enviar
  function dictate() {
    if (onDictate) return onDictate();
    if (dictating) { rec.current?.stop(); return; }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return recordForServer();
    const r = new Ctor();
    r.lang = "pt-BR";
    r.interimResults = false;
    r.continuous = false;
    const before = text;
    r.onresult = (e) => {
      const said = Array.from(e.results).filter((x) => x.isFinal).map((x) => x[0].transcript).join(" ").trim();
      if (said) setText(before ? `${before} ${said}` : said);
    };
    r.onerror = () => setDictating(false);
    r.onend = () => setDictating(false);
    rec.current = r;
    setDictating(true);
    r.start();
  }
  function submit(e?: FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || blocked) return;
    onSend(t);
    setText("");
  }
  return (
    <form onSubmit={submit} className="flex items-end gap-1 rounded-xl border border-border bg-surface p-1.5 shadow-pop has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-focus">
      <IconButton label="Enviar uma foto ou um áudio" onClick={onAttach} disabled={blocked || !onAttach}><Paperclip className="size-5" /></IconButton>
      <label htmlFor="composer" className="sr-only">Mensagem para o assistente</label>
      <textarea
        id="composer"
        rows={1}
        value={text}
        disabled={offline}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
        placeholder={offline ? "Sem conexão" : "Peça ou pergunte…"}
        className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-text placeholder:text-muted focus-visible:outline-none"
      />
      {text.trim() && !dictating ? (
        <IconButton label="Enviar" type="submit" disabled={blocked} className={cn(!blocked && "bg-accent text-on-accent hover:bg-accent hover:text-on-accent")}>
          <SendHorizontal className="size-5" />
        </IconButton>
      ) : (
        <>
          <IconButton label={dictating ? "Parar o ditado" : "Ditar mensagem"} aria-pressed={dictating} onClick={dictate}
            disabled={blocked || (!onDictate && !canDictate)} className={cn(dictating && "bg-accent text-on-accent hover:bg-accent hover:text-on-accent")}>
            <Mic className="size-5" />
          </IconButton>
          <IconButton label="Conversar por voz" onClick={onVoiceMode} disabled={blocked}><AudioLines className="size-5" /></IconButton>
        </>
      )}
    </form>
  );
}
