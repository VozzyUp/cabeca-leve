"use client";
import { Download, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearMemories, deleteAccount, deleteMemory, exportData, linkWhatsApp as startWhatsAppLink, testNotice, unlinkWhatsApp, updateSettings, updateWhatsApp } from "@/app/actions";
import { signOut } from "@/app/auth-actions";
import { pushSupported, subscribePush, unsubscribePush } from "@/lib/push-client";
import { Button } from "@/components/ui/button";
import { WHATSAPP_PROMISE } from "@/lib/whatsapp/promise";
import { Card, SectionLabel } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import type { Memory, Settings } from "@/lib/data/types";

// Salva cada mudança na hora e mostra "Salvo" ou o erro ao lado do título da seção
export function useSaver(initial: Settings) {
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, start] = useTransition();
  function save(patch: Partial<Settings>) {
    // mudanças seguidas (tom e logo depois tema) partem do estado mais novo, não de uma cópia antiga
    const keys = Object.keys(patch) as Array<keyof Settings>;
    const before = Object.fromEntries(keys.map((k) => [k, settings[k]])) as Partial<Settings>;
    setSettings((s) => ({ ...s, ...patch }));
    setStatus("saving");
    start(async () => {
      try { await updateSettings(patch); setStatus("saved"); }
      catch { setSettings((s) => ({ ...s, ...before })); setStatus("error"); }
    });
  }
  return { settings, save, status };
}

export function SaveStatus({ status }: { status: ReturnType<typeof useSaver>["status"] }) {
  return (
    <span role="status" className={cn("text-xs", status === "error" ? "text-danger" : "text-muted")}>
      {status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : status === "error" ? "Não deu para salvar. Tente de novo." : ""}
    </span>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-surface-3")}>
      <span aria-hidden className={cn("absolute top-0.5 size-5 rounded-full transition-[left] duration-150", checked ? "left-[18px] bg-on-accent" : "left-0.5 bg-muted")} />
    </button>
  );
}

export function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
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

type LinkResult = Awaited<ReturnType<typeof startWhatsAppLink>>;

// Código para confirmar o número, com o link que abre o WhatsApp já com a mensagem
function LinkCode({ result }: { result: LinkResult }) {
  if (!result || "limitReached" in result || !result.code) return null;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-md bg-surface-2 p-3 text-sm text-body">
      <p>Para confirmar que o número é seu, mande este código desse WhatsApp para o assistente (vale por 30 minutos):</p>
      <p className="font-mono text-2xl font-semibold tracking-widest text-text">{result.code}</p>
      {result.link && (
        <a href={result.link} target="_blank" rel="noopener noreferrer"
          className="inline-flex h-10 w-fit items-center rounded-md bg-accent px-4 text-sm font-semibold text-on-accent">Abrir o WhatsApp com o código</a>
      )}
    </div>
  );
}

// Vincular um WhatsApp: número (e, na conta dividida, o nome de quem usa) e o código de confirmação.
// Usado em Ajustes e na configuração inicial.
export function WhatsAppLinkForm({ channels, label = "WhatsApp", owner, askName = false, onDone, onResult }: {
  channels?: Settings["channels"]; label?: string; owner?: string | null; askName?: boolean; onDone?: () => void;
  onResult?: (r: LinkResult) => void;  // quem chama mostra o código (o formulário some quando a lista atualiza)
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(askName ? "" : channels?.whatsapp ?? "");
  const [name, setName] = useState(owner ?? "");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [linking, startLinking] = useTransition();
  const [result, setResult] = useState<LinkResult>(null);
  function linkWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    const n = toE164(phone);
    if (!n) { setPhoneError("Use o número com DDD, como 11 99999-0000."); return; }
    setPhoneError(null);
    startLinking(async () => {
      try {
        const r = await startWhatsAppLink(n, name.trim() || owner || null);
        if (r && "limitReached" in r) { setPhoneError(`Seu plano permite ${r.limitReached} número${r.limitReached === 1 ? "" : "s"} de WhatsApp. Remova um ou troque de plano.`); return; }
        setResult(r);
        onResult?.(r);
        if (r?.alreadyLinked) onDone?.();
        router.refresh();
      } catch { setPhoneError("Não deu para vincular agora. Tente de novo."); }
    });
  }
  const hint = askName ? "Com DDD. A pessoa confirma mandando um código desse WhatsApp."
    : !channels?.whatsapp ? `Mande e receba tudo pelo WhatsApp. ${WHATSAPP_PROMISE}`
    : channels.whatsappVerified === false ? `Aguardando confirmação: ${channels.whatsapp}` : `Vinculado: ${channels.whatsapp}`;
  return (
    <form onSubmit={linkWhatsApp} className="flex flex-col gap-2">
      {askName && <Field label="Nome de quem vai usar" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ex.: Ana" />}
      <div className="flex items-end gap-3">
        <Field label={label} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11 99999-0000"
          error={phoneError ?? undefined} className="flex-1" hint={hint} />
        <Button type="submit" variant="secondary" className="mb-6" loading={linking}>{!askName && channels?.whatsapp ? "Trocar" : "Vincular"}</Button>
      </div>
      {result && !("limitReached" in result) && result.alreadyLinked && <p role="status" className="text-sm text-body">Esse número já está vinculado. Nome atualizado.</p>}
      {!onResult && <LinkCode result={result} />}
    </form>
  );
}

// Os WhatsApps da conta (casal, família): nome de quem usa, se recebe os avisos e remover.
// Mostra quantos o plano permite e o formulário para mais um enquanto houver vaga.
export function WhatsAppNumbers({ initial, owner }: { initial: NonNullable<Settings["whatsapp"]>; owner: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState<LinkResult>(null);
  const { numbers, limit } = initial;
  const gotCode = (r: LinkResult) => { setCode(r); if (r && !("limitReached" in r) && r.code) setAdding(false); };
  const run = (fn: () => Promise<unknown>) => start(async () => {
    setError(null);
    try { await fn(); router.refresh(); } catch { setError("Não deu para salvar. Tente de novo."); }
  });
  const canAdd = numbers.length < limit;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-text">WhatsApp</span>
        <span className="text-xs text-muted">{numbers.length} de {limit} número{limit === 1 ? "" : "s"} do seu plano</span>
      </div>
      {numbers.length === 0 && <WhatsAppLinkForm label="Seu número de WhatsApp" owner={owner} onResult={gotCode} />}
      {numbers.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {numbers.map((n) => (
            <li key={n.id} className="flex flex-col gap-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-text">{n.label ?? "Sem nome"}</span>
                  <span className="font-mono text-xs text-muted">{n.number} · {n.verified ? "vinculado" : "aguardando o código"}</span>
                </span>
                <Button variant="ghost" size="sm" disabled={busy} aria-label={`Remover ${n.label ?? n.number}`}
                  onClick={() => { if (window.confirm(`Desvincular ${n.number}? Esse número para de falar com a conta na hora.`)) run(() => unlinkWhatsApp(n.id)); }}>Remover</Button>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <form className="flex flex-1 items-end gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  const v = String(new FormData(e.currentTarget).get("nome") ?? "").trim();
                  run(() => updateWhatsApp(n.id, { label: v || null }));
                }}>
                  <Field label="Nome de quem usa" name="nome" defaultValue={n.label ?? ""} maxLength={40} className="min-w-36 flex-1" />
                  <Button type="submit" variant="secondary" size="sm" className="mb-1" disabled={busy}>Salvar</Button>
                </form>
                <span className="flex items-center gap-2 pb-2 text-xs text-body">
                  Recebe os avisos
                  <Switch label={`Avisos no ${n.label ?? n.number}`} checked={n.receivesNotices} onChange={(v) => run(() => updateWhatsApp(n.id, { receivesNotices: v }))} />
                </span>
              </div>
              {!n.verified && <WhatsAppLinkForm label="Mandar o código de novo" channels={{ whatsapp: n.number, whatsappVerified: false, telegram: false, email: false, push: false }} />}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <LinkCode result={code} />
      {numbers.length > 0 && (canAdd ? (
        adding ? <WhatsAppLinkForm label="Número" askName onDone={() => setAdding(false)} onResult={gotCode} />
          : <Button variant="secondary" className="w-fit" onClick={() => setAdding(true)}>Adicionar outro WhatsApp</Button>
      ) : (
        <p className="text-xs text-muted">Para vincular mais números (casal, família), <a href="/planos" className="underline">veja os planos</a>.</p>
      ))}
      <p className="text-xs text-muted">Cada pessoa conversa pelo próprio WhatsApp e vê os mesmos dados da conta. Os gastos ficam marcados com o nome de quem lançou.</p>
    </div>
  );
}

// Notificações no aparelho: ligar pede a permissão do navegador e inscreve este aparelho
export function PushSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-1">
      <Switch label="Notificações no aparelho" checked={checked} onChange={async (v) => {
        if (v && pushSupported()) {
          const r = await subscribePush();
          if (r === "denied") { setNote("O navegador bloqueou as notificações. Libere nas permissões do site."); return; }
        }
        if (!v) await unsubscribePush().catch(() => {});
        setNote(null);
        onChange(v);
      }} />
      {note && <span role="alert" className="max-w-56 text-right text-xs text-danger">{note}</span>}
    </span>
  );
}

// ---- S29 ----
export function SettingsForm({ initial, canSignOut }: { initial: Settings; canSignOut: boolean }) {
  const { settings, save, status } = useSaver(initial);
  const [name, setName] = useState(initial.name);
  const [confirm, setConfirm] = useState("");
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, startExport] = useTransition();
  const router = useRouter();
  const channels = settings.channels;
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
        {canSignOut && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => startExport(async () => { await signOut(false); router.push("/entrar"); router.refresh(); })}>Sair</Button>
            <Button variant="ghost" size="sm" onClick={() => startExport(async () => { await signOut(true); router.push("/entrar"); router.refresh(); })}>Sair de todos os aparelhos</Button>
          </div>
        )}
      </Card>

      <Card className="flex flex-col">
        <SectionLabel className="mb-1">Onde o assistente fala com você</SectionLabel>
        <div className="border-b border-border py-3">
          {/* lista vem das props (atualiza com router.refresh); o resto do formulário guarda estado local */}
          {initial.whatsapp ? <WhatsAppNumbers initial={initial.whatsapp} owner={settings.name} /> : <WhatsAppLinkForm channels={channels} />}
        </div>
        <Row title="Notificações no aparelho" hint="lembretes e avisos, mesmo com o app fechado">
          <PushSwitch checked={channels.push} onChange={(v) => save({ channels: { ...channels, push: v } })} />
        </Row>
        {canSignOut && <TestNotice />}
        <Row title="E-mail" hint="resumos e recibos">
          <Switch label="E-mail" checked={channels.email} onChange={(v) => save({ channels: { ...channels, email: v } })} />
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
export const TONES: Array<{ id: Settings["tone"]; label: string; hint: string }> = [
  { id: "warm", label: "Acolhedor", hint: "gentil, como um amigo organizado" },
  { id: "direct", label: "Direto", hint: "só o essencial, sem rodeios" },
  { id: "playful", label: "Divertido", hint: "leve, com piadinhas" },
  { id: "tough", label: "Sem filtro", hint: "zoa, cobra e puxa a orelha (pode soltar palavrão leve)" },
];

// Escolha do tom com um exemplo de resposta em cada opção (Ajustes e configuração inicial)
export function ToneChooser({ value, onChange }: { value: Settings["tone"]; onChange: (t: Settings["tone"]) => void }) {
  return (
    <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <legend className="sr-only">Tom da conversa</legend>
      {TONES.map((t) => (
        <label key={t.id} className={cn("flex cursor-pointer flex-col gap-1 rounded-md border p-3",
          value === t.id ? "border-accent bg-surface-2" : "border-border hover:bg-surface-2")}>
          <span className="flex items-center gap-2 text-sm font-medium text-text">
            <input type="radio" name="tom-da-conversa" value={t.id} checked={value === t.id} onChange={() => onChange(t.id)} className="accent-[var(--c-accent)]" />
            {t.label}<span className="font-normal text-muted">· {t.hint}</span>
          </span>
          <span className="pl-6 text-xs text-muted">“{TONE_SAMPLE[t.id]}”</span>
        </label>
      ))}
    </fieldset>
  );
}
export const TONE_SAMPLE: Record<Settings["tone"], string> = {
  direct: "Feito: lembrete para amanhã às 9h. Mais alguma coisa?",
  warm: "Prontinho! Amanhã às 9h eu te lembro. Qualquer coisa, é só falar.",
  playful: "Anotado e guardado a sete chaves! Amanhã às 9h eu apareço pra te lembrar.",
  tough: "Anotado, 9h eu te cutuco. E pô, terceiro iFood da semana? Bora abrir essa geladeira aí.",
};

export function AssistantForm({ initial, memories: initialMemories }: { initial: Settings; memories: Memory[] }) {
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
        <ToneChooser value={settings.tone} onChange={(tone) => save({ tone })} />
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
        <MemoryList initial={initialMemories} enabled={settings.memoryEnabled} />
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <SectionLabel>Aparência</SectionLabel>
        <Segmented label="Tema" value={settings.theme} onChange={(theme) => save({ theme })}
          options={[{ value: "dark", label: "Escuro" }, { value: "light", label: "Claro" }, { value: "system", label: "Do aparelho" }]} />
      </Card>
    </div>
  );
}

const PUSH_TEXT = {
  sent: (n: number) => `Notificação enviada para ${n} aparelho${n === 1 ? "" : "s"}. Se não apareceu, confira se o navegador ou o celular está silenciando o site.`,
  "no-device": () => "Nenhum aparelho com notificação ligada. Ligue acima neste aparelho.",
  off: () => "Notificações no aparelho estão desligadas.",
  error: () => "Não deu para mandar a notificação agora (confira as chaves VAPID do app).",
  "not-configured": () => "Notificações no aparelho ainda não estão ligadas neste app.",
} as const;
const WA_TEXT = {
  sent: (n: string | null) => `Mensagem enviada para ${n} no WhatsApp.`,
  "not-linked": () => "WhatsApp não vinculado: vincule acima para receber os lembretes por lá também.",
  error: () => "Não deu para mandar pelo WhatsApp agora. Tente de novo em instantes.",
  "not-configured": () => "WhatsApp ainda não está ligado neste app.",
} as const;

// F6: descobrir hoje, e não na hora do remédio, que um canal não está chegando
function TestNotice() {
  const [result, setResult] = useState<Awaited<ReturnType<typeof testNotice>> | null>(null);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 border-b border-border py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col"><span className="text-sm text-text">Testar aviso agora</span>
          <span className="text-xs text-muted">manda um aviso de teste em cada canal ligado</span></span>
        <Button variant="secondary" size="sm" loading={pending} onClick={() => start(async () => {
          setError(false);
          try { setResult(await testNotice()); } catch { setError(true); }
        })}>Testar</Button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">Não deu para testar agora. Tente de novo.</p>}
      {result && (
        <ul role="status" className="flex flex-col gap-1 text-xs text-body">
          <li><span className="font-medium text-text">Aparelho:</span> {PUSH_TEXT[result.push](result.devices)}</li>
          <li><span className="font-medium text-text">WhatsApp:</span> {WA_TEXT[result.whatsapp](result.numbers.join(", "))}</li>
          <li><span className="font-medium text-text">No app:</span> está em Avisos.</li>
          {result.detail && <li className="text-muted">Detalhe técnico: {result.detail}</li>}
        </ul>
      )}
    </div>
  );
}

// O que o assistente guardou, com opção de esquecer cada item ou tudo
function MemoryList({ initial, enabled }: { initial: Memory[]; enabled: boolean }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [pending, start] = useTransition();
  function forget(m: Memory) {
    setError(false);
    setItems((l) => l.filter((x) => x.id !== m.id));
    start(async () => { try { await deleteMemory(m.id); } catch { setItems((l) => [m, ...l]); setError(true); } });
  }
  function forgetAll() {
    const before = items;
    setError(false); setConfirmAll(false); setItems([]);
    start(async () => { try { await clearMemories(); } catch { setItems(before); setError(true); } });
  }
  return (
    <div className="mt-2 flex flex-col gap-2">
      {!enabled && <p className="text-xs text-muted">A memória está desligada: o assistente não guarda nada novo nem usa o que está aqui. Você pode apagar o que já foi guardado.</p>}
      {items.length === 0 ? (
        <p className="text-xs text-muted">{enabled ? "Nada guardado ainda. Diga na conversa “lembra que eu recebo dia 5” e aparece aqui." : "Nada guardado."}</p>
      ) : (
        <>
          <ul aria-label="O que o assistente guardou" className="flex flex-col divide-y divide-border rounded-md border border-border">
            {items.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-body">
                <span className="min-w-0 break-words">{m.fact}</span>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => forget(m)} aria-label={`Esquecer: ${m.fact}`} icon={<Trash2 className="size-4" />}>Esquecer</Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            {confirmAll ? (
              <>
                <span className="text-xs text-body">Esquecer os {items.length} itens?</span>
                <Button variant="secondary" size="sm" disabled={pending} onClick={forgetAll}>Sim, esquecer tudo</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmAll(false)}>Cancelar</Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmAll(true)}>Esquecer tudo</Button>
            )}
          </div>
        </>
      )}
      {error && <p role="alert" className="text-xs text-danger">Não deu para apagar. Tente de novo.</p>}
    </div>
  );
}
