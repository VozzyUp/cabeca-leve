"use client";
import { Pause, Play, Square } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { saveFocusSession } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";

type Phase = "idle" | "running" | "paused" | "finished";
const pad = (n: number) => String(n).padStart(2, "0");

// Som curto no fim, gerado na hora (sem arquivo de áudio)
function chime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch { /* sem áudio no aparelho: o aviso na tela basta */ }
}

// S07: timer de foco com pausa, término antecipado e registro da sessão
export function FocusTimer({ initialTitle, suggestions }: { initialTitle: string; suggestions: string[] }) {
  const [title, setTitle] = useState(initialTitle);
  const [minutes, setMinutes] = useState<"15" | "25" | "50">("25");
  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(25 * 60_000);
  const [endsAt, setEndsAt] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  function finish(early: boolean) {
    const planned = Number(minutes);
    const done = early ? Math.max(1, Math.round((planned * 60_000 - remaining) / 60_000)) : planned;
    setPhase("finished");
    if (!early) chime();
    start(async () => {
      try { await saveFocusSession({ title: title.trim(), minutes: done, startedAt: startedAt!, finishedAt: new Date().toISOString() }); }
      catch { setError("A sessão terminou, mas não deu para salvar no histórico."); }
    });
  }

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      const left = Math.max(0, endsAt - Date.now());
      setRemaining(left);
      if (left === 0) finish(false);
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish lê o estado atual a cada tique
  }, [phase, endsAt]);

  function begin() {
    if (!title.trim()) { setError("Diga no que você vai focar."); return; }
    setError(null);
    const ms = Number(minutes) * 60_000;
    setRemaining(ms);
    setEndsAt(Date.now() + ms);
    setStartedAt(new Date().toISOString());
    setPhase("running");
  }
  const mm = Math.floor(remaining / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000);

  return (
    <Card className="flex flex-col items-center gap-6 py-8">
      {phase === "idle" ? (
        <div className="flex w-full max-w-md flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="foco-titulo" className="text-sm font-medium text-body">No que você vai focar?</label>
            <input id="foco-titulo" list="foco-sugestoes" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: terminar o relatório"
              aria-invalid={error ? true : undefined} aria-describedby={error ? "foco-erro" : undefined}
              className="h-10 rounded-md border border-border-input bg-bg px-3 text-sm text-text placeholder:text-muted aria-[invalid=true]:border-danger" />
            <datalist id="foco-sugestoes">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
            {error && <p id="foco-erro" className="text-xs text-danger">{error}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented label="Duração" value={minutes} onChange={(v) => { setMinutes(v); setRemaining(Number(v) * 60_000); }}
              options={[{ value: "15", label: "15 min" }, { value: "25", label: "25 min" }, { value: "50", label: "50 min" }]} />
            <Button onClick={begin} icon={<Play className="size-4" />}>Começar</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="max-w-md text-center text-sm text-body">{title}</p>
          <p className="font-mono text-7xl font-semibold tabular-nums text-text" aria-hidden>{pad(mm)}:{pad(ss)}</p>
          {/* para leitor de tela, só a cada minuto, para não falar sem parar */}
          <p className="sr-only" aria-live="polite">{phase === "finished" ? "Sessão concluída" : `Faltam ${mm + (ss > 0 ? 1 : 0)} minutos`}</p>
          {phase === "finished" ? (
            <div className="flex flex-col items-center gap-3">
              <p role="status" className="text-sm font-medium text-success">Sessão concluída{saving ? "…" : "."}</p>
              {error && <p role="alert" className="text-xs text-danger">{error}</p>}
              <Button variant="secondary" onClick={() => { setPhase("idle"); setRemaining(Number(minutes) * 60_000); setError(null); }}>Nova sessão</Button>
            </div>
          ) : (
            <div className="flex gap-3">
              {phase === "running" ? (
                <Button variant="secondary" icon={<Pause className="size-4" />} onClick={() => setPhase("paused")}>Pausar</Button>
              ) : (
                <Button variant="secondary" icon={<Play className="size-4" />} onClick={() => { setEndsAt(Date.now() + remaining); setPhase("running"); }}>Continuar</Button>
              )}
              <Button variant="ghost" icon={<Square className="size-4" />} onClick={() => finish(true)}>Terminar</Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
