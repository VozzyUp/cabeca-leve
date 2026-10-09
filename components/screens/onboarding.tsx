"use client";
import { Check, MessageCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { updateSettings } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import type { Settings } from "@/lib/data/types";
import { PushSwitch, Row, Switch, ToneChooser, WhatsAppLinkForm } from "./settings-forms";

const TITLES = ["Boas-vindas! Vamos deixar tudo do seu jeito", "Fale comigo pelo WhatsApp", "Como você quer ser avisado", "Tudo pronto"];
const EXAMPLES = ["gastei 35 na padaria", "me lembra de pagar a luz amanhã às 9h", "quero ler 20 minutos todo dia às 21h", "monta um treino de 3 dias pra mim"];

// Configuração inicial: abre sozinha na primeira entrada e de novo pelo menu da conta
// (?configurar=1). Fechar em qualquer passo conta como feito: nada de janela insistindo.
export function Onboarding({ initial }: { initial: Settings }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const asked = params.get("configurar") === "1";
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && (asked || initial.onboarded === false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial.name === "você" ? "" : initial.name);
  const [tone, setTone] = useState(initial.tone);
  const [channels, setChannels] = useState(initial.channels);
  const [briefing, setBriefing] = useState(initial.briefingTime);
  const [saving, start] = useTransition();
  const [error, setError] = useState(false);

  function save(patch: Partial<Settings>, then?: () => void) {
    setError(false);
    start(async () => {
      try { await updateSettings(patch); then?.(); }
      catch { setError(true); }
    });
  }
  function close() {
    setDismissed(true);
    setStep(0);
    if (asked) router.replace(path);
    if (initial.onboarded === false) start(async () => { await updateSettings({ onboarded: true }).catch(() => {}); });
  }

  return (
    <Dialog open={open} onClose={close} title={TITLES[step]}>
      <ol aria-label={`Passo ${step + 1} de ${TITLES.length}`} className="flex gap-1.5">
        {TITLES.map((t, i) => <li key={t} aria-hidden className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-surface-3")} />)}
      </ol>
      <p className="text-xs text-muted">Passo {step + 1} de {TITLES.length}</p>

      {step === 0 && (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save({ name: name.trim(), tone }, () => setStep(1)); }}>
          <Field label="Como quer que eu chame você?" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="given-name" />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-text">Qual jeito de conversar combina com você?</p>
            <ToneChooser value={tone} onChange={setTone} />
          </div>
          <Footer saving={saving} error={error} disabled={!name.trim()} onSkip={close} skipLabel="Fazer depois" />
        </form>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-body">Com o WhatsApp vinculado, você anota gastos, cria lembretes e recebe os avisos por lá, com botões para concluir ou adiar.</p>
          <WhatsAppLinkForm channels={channels} label="Seu número de WhatsApp" />
          <Footer onNext={() => setStep(2)} onSkip={() => setStep(2)} skipLabel="Pular por agora" nextLabel={channels.whatsapp ? "Continuar" : undefined} />
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col">
          <Row title="Notificações neste aparelho" hint="lembretes chegam mesmo com o app fechado">
            <PushSwitch checked={channels.push} onChange={(v) => { const c = { ...channels, push: v }; setChannels(c); save({ channels: c }); }} />
          </Row>
          <Row title="Resumo da manhã" hint={briefing ? `todo dia às ${briefing}: agenda, tarefas e contas` : "um resumo do seu dia, toda manhã"}>
            <Switch label="Resumo da manhã" checked={!!briefing} onChange={(v) => { const b = v ? "07:00" : null; setBriefing(b); save({ briefingTime: b }); }} />
          </Row>
          {briefing && (
            <div className="flex items-center justify-between gap-4 pb-2">
              <label htmlFor="boas-vindas-hora" className="text-sm text-text">Horário do resumo</label>
              <input id="boas-vindas-hora" type="time" value={briefing} onChange={(e) => { if (e.target.value) { setBriefing(e.target.value); save({ briefingTime: e.target.value }); } }}
                className="h-10 rounded-md border border-border-input bg-bg px-3 font-mono text-sm text-text" />
            </div>
          )}
          <div className="pt-3"><Footer saving={saving} error={error} onNext={() => setStep(3)} /></div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-body">É só falar comigo do seu jeito, por texto, áudio ou foto. Experimente:</p>
          <ul className="flex flex-col gap-2">
            {EXAMPLES.map((e) => (
              <li key={e} className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm text-text">
                <MessageCircle aria-hidden className="size-4 shrink-0 text-accent" />{e}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Avisos, tema e sua conta ficam no canto de cima. Para mudar estas escolhas depois, use Ajustes.</p>
          <Button size="lg" icon={<Check className="size-5" />} loading={saving}
            onClick={() => { close(); if (path !== "/conversa") router.push("/conversa"); }}>Começar a usar</Button>
        </div>
      )}
    </Dialog>
  );
}

function Footer({ saving, error, disabled, onNext, onSkip, nextLabel = "Continuar", skipLabel }: {
  saving?: boolean; error?: boolean; disabled?: boolean; onNext?: () => void; onSkip?: () => void; nextLabel?: string; skipLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {error && <p role="alert" className="text-xs text-danger">Não deu para salvar. Tente de novo.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {onSkip ? <Button variant="ghost" onClick={onSkip}>{skipLabel}</Button> : <span />}
        <Button type={onNext ? "button" : "submit"} onClick={onNext} loading={saving} disabled={disabled}>{nextLabel}</Button>
      </div>
    </div>
  );
}
