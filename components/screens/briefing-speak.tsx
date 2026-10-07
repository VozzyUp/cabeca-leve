"use client";
import { Square, Volume2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const subscribe = () => () => {};

// Lê o resumo em voz alta com a voz do navegador (o áudio gerado no servidor fica para o backend)
export function BriefingSpeak({ text }: { text: string }) {
  const supported = useSyncExternalStore(subscribe, () => "speechSynthesis" in window, () => false);
  const [speaking, setSpeaking] = useState(false);
  if (!supported) return null;
  function toggle() {
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    speechSynthesis.speak(u);
    setSpeaking(true);
  }
  return (
    <Button variant="secondary" size="sm" onClick={toggle} icon={speaking ? <Square className="size-4" /> : <Volume2 className="size-4" />}>
      {speaking ? "Parar" : "Ouvir"}
    </Button>
  );
}
