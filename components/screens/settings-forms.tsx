"use client";
import { Download, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAccount, exportData, updateSettings } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import type { Settings } from "@/lib/data/types";

// Salva cada mudança na hora e mostra "Salvo" ou o erro ao lado do título da seção
function useSaver(initial: Settings) {
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, start] = useTransition();
  function save(patch: Partial<Settings>) {
    const before = settings;
    setSettings({ ...settings, ...patch });
    setStatus("saving");
    start(async () => {
      try { await updateSettings(patch); setStatus("saved"); }
      catch { setSettings(before); setStatus("error"); }
    });
  }
  return { settings, save, status };
}

function SaveStatus({ status }: { status: ReturnType<typeof useSaver>["status"] }) {
  return (
    <span role="status" className={cn("text-xs", status === "error" ? "text-danger" : "text-muted")}>
      {status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : status === "error" ? "Não deu para salvar. Tente de novo." : ""}
    </span>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-surface-3")}>
      <span aria-hidden className={cn("absolute top-0.5 size-5 rounded-full transition-[left] duration-150", checked ? "left-[18px] bg-on-accent" : "left-0.5 bg-muted")} />
    </button>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="flex min-w-0 flex-col"><span className="text-sm text-text">{title}</span>{hint && <span className="text-xs text-muted">{hint}</span>}</span>
      {children}
    </div>
  );
}

// "+55 11 99999-0000" -> "+5511999990000"
const toE164 = (s: string) => {
  const digits = s.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return /^55\d{10,11}$/.test(full) ? `+${full}` : null;
};

// ---- S29 ----
export function SettingsForm({ initial }: { initial: Settings }) {
  const { settings, save, status } = useSaver(initial);
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.channels.whatsapp ?? "");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, startExport] = useTransition();
  const router = useRouter();
  const channels = settings.channels;

  function linkWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    const n = toE164(phone);
    if (!n) { setPhoneError("Use o número com DDD, como 11 99999-0000."); return; }
    setPhoneError(null);
    save({ channels: { ...channels, whatsapp: n } });
  }
  function download() {
    startExport(async () => {
      const json = await exportData();
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "meus-dados.json" });
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end"><SaveStatus status={status} /></div>
      <Card className="flex flex-col gap-4">
        <SectionLabel>Conta</SectionLabel>
        <form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save({ name: name.trim() }); }}>
          <Field label="Como o assistente chama você" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" maxLength={80} />
          <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === settings.name}>Salvar</Button>
        </form>
        <p className="text-sm text-body">E-mail: <span className="text-text">{settings.email || "—"}</span></p>
      </Card>

      <Card className="flex flex-col">
        <SectionLabel className="mb-1">Onde o assistente fala com você</SectionLabel>
        <form onSubmit={linkWhatsApp} className="flex flex-col gap-2 border-b border-border py-3">
          <div className="flex items-end gap-3">
            <Field label="WhatsApp" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11 99999-0000"
              error={phoneError ?? undefined} hint={channels.whatsapp ? `Vinculado: ${channels.whatsapp}` : "Mande e receba tudo pelo WhatsApp"} className="flex-1" />
            <Button type="submit" variant="secondary" className="mb-6">{channels.whatsapp ? "Trocar" : "Vincular"}</Button>
          </div>
          {channels.whatsapp && <p className="text-xs text-muted">A mensagem de boas-vindas chega quando a integração com a Meta estiver ligada.</p>}
        </form>
        <Row title="Notificações no aparelho" hint="lembretes e avisos, mesmo com o app fechado">
          <Switch label="Notificações no aparelho" checked={channels.push} onChange={(v) => save({ channels: { ...channels, push: v } })} />
        </Row>
        <Row title="E-mail" hint="resumos e recibos">
          <Switch label="E-mail" checked={channels.email} onChange={(v) => save({ channels: { ...channels, email: v } })} />
        </Row>
        <Row title="Telegram">
          <Switch label="Telegram" checked={channels.telegram} onChange={(v) => save({ channels: { ...channels, telegram: v } })} />
        </Row>
      </Card>

      <Card className="flex flex-col">
        <SectionLabel className="mb-1">Resumo da manhã</SectionLabel>
        <Row title="Receber o resumo do dia" hint={settings.briefingTime ? `todo dia às ${settings.briefingTime}` : "desligado"}>
          <Switch label="Receber o resumo do dia" checked={!!settings.briefingTime} onChange={(v) => save({ briefingTime: v ? "07:00" : null })} />
        </Row>
        {settings.briefingTime && (
          <div className="flex items-center justify-between gap-4 pb-2">
            <label htmlFor="hora-resumo" className="text-sm text-text">Horário</label>
            <input id="hora-resumo" type="time" value={settings.briefingTime} onChange={(e) => e.target.value && save({ briefingTime: e.target.value })}
              className="h-10 rounded-md border border-border-input bg-bg px-3 font-mono text-sm text-text" />
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>Seus dados</SectionLabel>
        <Row title="Baixar meus dados" hint="tudo o que está guardado, num arquivo JSON">
          <Button variant="secondary" size="sm" loading={exporting} icon={<Download className="size-4" />} onClick={download}>Baixar</Button>
        </Row>
        <div className="flex flex-col gap-3 rounded-md border border-danger p-4">
          <p className="text-sm font-medium text-text">Excluir a conta</p>
          <p className="text-sm text-body">Apaga tarefas, lembretes, finanças, hábitos, notas, conversas e a assinatura. Não dá para desfazer.</p>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
            e.preventDefault();
            setDeleteError(null);
            startDelete(async () => {
              try { await deleteAccount(confirm); router.push("/entrar?conta=excluida"); }
              catch { setDeleteError("Não deu para excluir. Confira a confirmação e tente de novo."); }
            });
          }}>
            <Field label='Digite "EXCLUIR" para confirmar' value={confirm} onChange={(e) => setConfirm(e.target.value)} className="min-w-48 flex-1" error={deleteError ?? undefined} />
            <Button type="submit" variant="danger" loading={deleting} disabled={confirm.trim().toUpperCase() !== "EXCLUIR"} icon={<Trash2 className="size-4" />}
              className={deleteError ? "mb-6" : undefined}>Excluir tudo</Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

// ---- S30 ----
const TONE_SAMPLE: Record<Settings["tone"], string> = {
  direct: "Feito: lembrete para amanhã às 9h. Mais alguma coisa?",
  warm: "Prontinho! Amanhã às 9h eu te lembro. Qualquer coisa, é só falar.",
  playful: "Anotado e guardado a sete chaves! Amanhã às 9h eu apareço pra te lembrar.",
};

export function AssistantForm({ initial }: { initial: Settings }) {
  const { settings, save, status } = useSaver(initial);
  function sample() {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(TONE_SAMPLE[settings.tone]);
    u.lang = "pt-BR";
    // a voz do navegador é só a prévia; a voz definitiva vem do serviço de voz no backend
    u.pitch = settings.voice === "female" ? 1.15 : 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end"><SaveStatus status={status} /></div>
      <Card className="flex flex-col gap-4">
        <SectionLabel>Tom</SectionLabel>
        <Segmented label="Tom da conversa" value={settings.tone} onChange={(tone) => save({ tone })}
          options={[{ value: "direct", label: "Direto" }, { value: "warm", label: "Acolhedor" }, { value: "playful", label: "Divertido" }]} />
        <div className="rounded-md bg-surface-2 px-4 py-3 text-sm text-body" aria-live="polite">
          <span className="sr-only">Exemplo de resposta: </span>{TONE_SAMPLE[settings.tone]}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-text">Tamanho das respostas</span>
          <Segmented label="Tamanho das respostas" value={settings.answerLength} onChange={(answerLength) => save({ answerLength })}
            options={[{ value: "short", label: "Curtas" }, { value: "detailed", label: "Detalhadas" }]} />
        </div>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col"><SectionLabel>Voz</SectionLabel><span className="text-xs text-muted">no modo de voz e no resumo em áudio</span></span>
        <div className="flex items-center gap-2">
          <Segmented label="Voz" value={settings.voice} onChange={(voice) => save({ voice })}
            options={[{ value: "female", label: "Feminina" }, { value: "male", label: "Masculina" }]} />
          <Button variant="ghost" size="sm" icon={<Play className="size-4" />} onClick={sample}>Ouvir</Button>
        </div>
      </Card>
      <Card className="flex flex-col">
        <SectionLabel className="mb-1">Memória</SectionLabel>
        <Row title="Lembrar o que eu conto" hint="preferências e fatos, como 'sou vegetariana' ou 'recebo dia 5', para responder melhor">
          <Switch label="Lembrar o que eu conto" checked={settings.memoryEnabled} onChange={(memoryEnabled) => save({ memoryEnabled })} />
        </Row>
        <p className="text-xs text-muted">O que o assistente guardou vai aparecer aqui, com opção de apagar cada item, quando a memória estiver ligada ao backend.</p>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <SectionLabel>Aparência</SectionLabel>
        <Segmented label="Tema" value={settings.theme} onChange={(theme) => save({ theme })}
          options={[{ value: "dark", label: "Escuro" }, { value: "light", label: "Claro" }, { value: "system", label: "Do aparelho" }]} />
      </Card>
    </div>
  );
}
