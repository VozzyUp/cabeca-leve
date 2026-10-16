"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { checkWhatsApp, generateSystemSecret, revealIntegrationInfo, saveSystemConfig, testAnthropicKey } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import type { ConfigGroup, FieldStatus } from "@/lib/app-config";

const SOURCE = { banco: "salvo aqui", stack: "vem do stack", faltando: "não configurado" } as const;

function FieldRow({ field, status, value, onChange, onClear, onGenerate, busy }: {
  field: ConfigGroup["fields"][number]; status?: FieldStatus; value: string; onChange: (v: string) => void;
  onClear: () => void; onGenerate: () => void; busy: boolean;
}) {
  const id = useId();
  const tone = status?.source === "faltando" && !field.fallback ? "text-warning" : "text-muted";
  return (
    <div className="flex flex-col gap-1.5 border-b border-border py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-text">{field.label}</label>
        <span className={`text-xs ${tone}`}>
          {status?.source === "faltando" && field.fallback ? "padrão" : SOURCE[status?.source ?? "faltando"]}{status?.preview ? `: ${status.preview}` : ""}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {field.options ? (
          <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-3 text-sm text-text">
            <option value="">{status?.preview ? "manter como está" : field.fallback ?? "escolha…"}</option>
            {field.options.map((o) => <option key={o} value={o}>{field.labels?.[o] ?? o}</option>)}
          </select>
        ) : (
          <input id={id} type={field.secret ? "password" : "text"} autoComplete="off" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)}
            placeholder={status?.preview ? (field.secret ? "digite para trocar" : "manter como está") : field.hint ?? ""}
            className="h-10 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-3 font-mono text-sm text-text placeholder:font-sans placeholder:text-muted" />
        )}
        {field.generate && <Button type="button" variant="secondary" size="sm" loading={busy} onClick={onGenerate}>Gerar</Button>}
        {status?.source === "banco" && <Button type="button" variant="ghost" size="sm" onClick={onClear}>Apagar</Button>}
      </div>
      {field.hint && status?.preview && <p className="text-xs text-muted">{field.hint}</p>}
    </div>
  );
}

export function AdminConfigForm({ group, status }: { group: ConfigGroup; status: FieldStatus[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const byKey = new Map(status.map((s) => [s.key, s]));
  const run = (fn: () => Promise<unknown>, ok: string) => start(async () => {
    setMessage(null);
    try { await fn(); setValues({}); setMessage({ ok: true, text: ok }); }
    catch (e) { setMessage({ ok: false, text: (e as Error).message || "Não deu para salvar. Tente de novo." }); }
  });
  const changed = Object.entries(values).filter(([, v]) => v.trim() !== "");
  return (
    <Card>
      <form onSubmit={(e) => { e.preventDefault(); run(() => saveSystemConfig(Object.fromEntries(changed)), "Salvo. Já está valendo."); }}>
        <SectionLabel className="mb-1">{group.title}</SectionLabel>
        {group.fields.map((f) => (
          <FieldRow key={f.key} field={f} status={byKey.get(f.key)} value={values[f.key] ?? ""} busy={pending}
            onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
            onClear={() => run(() => saveSystemConfig({ [f.key]: null }), "Apagado. Volta a valer o que estiver no stack.")}
            onGenerate={() => run(() => generateSystemSecret(f.generate!, f.key), f.generate === "vapid" ? "Chaves do push geradas." : "Gerado e salvo.")} />
        ))}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" loading={pending} disabled={changed.length === 0}>Salvar {group.title.split(" (")[0].toLowerCase()}</Button>
          {group.fields.some((f) => f.key === "ANTHROPIC_API_KEY") && (
            <Button type="button" variant="secondary" size="sm" loading={pending}
              onClick={() => start(async () => {
                setMessage(null);
                try { const r = await testAnthropicKey(); setMessage(r.ok ? { ok: true, text: `A chave funciona (${r.model}, nível ${r.effort}).` } : { ok: false, text: r.message }); }
                catch (e) { setMessage({ ok: false, text: (e as Error).message || "Não deu para testar." }); }
              })}>Testar chave</Button>
          )}
          {message && <p role={message.ok ? "status" : "alert"} className={`text-xs ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</p>}
        </div>
      </form>
    </Card>
  );
}

// Endereços e tokens para colar nos painéis da UAZAPI, da Asaas e da Meta
// `version` muda quando um segredo é salvo ou gerado: com o painel aberto, ele busca de novo,
// para não ficar mostrando "gere abaixo" depois de gerar.
export function IntegrationInfo({ version }: { version: string }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof revealIntegrationInfo>> | null>(null);
  const [pending, start] = useTransition();
  const open = useRef(false);
  useEffect(() => {
    if (open.current) revealIntegrationInfo().then(setInfo).catch(() => setInfo(null));
  }, [version]);
  const rows = info ? [
    ["Webhook da UAZAPI (POST /webhook da instância)", info.whatsappWebhook ?? "gere o segredo do webhook da UAZAPI abaixo"],
    ["Webhook da Asaas (Integrações > Webhooks)", info.asaasWebhook],
    ["Token do webhook da Asaas", info.asaasToken ?? "gere abaixo"],
    ["Callback da Meta", info.metaCallback],
    ["Token de verificação da Meta", info.metaVerifyToken ?? "gere abaixo"],
  ] : [];
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionLabel>Endereços para colar nos serviços</SectionLabel>
        <Button variant="secondary" size="sm" loading={pending} onClick={() => start(async () => { open.current = !info; setInfo(info ? null : await revealIntegrationInfo()); })}>
          {info ? "Esconder" : "Mostrar"}
        </Button>
      </div>
      {info && (
        <dl className="flex flex-col gap-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="break-all font-mono text-text">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

type Diagnosis = Awaited<ReturnType<typeof checkWhatsApp>>;

const ago = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return min < 1 ? "agora há pouco" : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : `há ${Math.round(min / 1440)} dias`;
};

function Line({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return <li className={`flex gap-2 ${ok === false ? "text-danger" : ok === true ? "text-text" : "text-body"}`}><span aria-hidden>{ok === true ? "✓" : ok === false ? "✗" : "•"}</span><span>{children}</span></li>;
}

// Quando o WhatsApp "não responde": mostra o último sinal que chegou ao sistema e o que a UAZAPI diz (conectada? para onde manda?)
export function WhatsAppDiagnostic() {
  const [data, setData] = useState<Diagnosis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    setError(null);
    try { setData(await checkWhatsApp()); } catch { setError("Não deu para conferir agora. Tente de novo."); }
  });
  const u = data?.check.uazapi;
  const hooks = u?.webhooks ?? [];
  const good = hooks.some((h) => h.pointsHere && h.secretOk);
  const signals = data ? ([["Último aviso que chegou do WhatsApp", data.signals.whatsapp_webhook], ["Fila (processamento)", data.signals.whatsapp_job], ["Último número que mandou mensagem", data.signals.whatsapp_inbound]] as const) : [];
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <SectionLabel>Diagnóstico do WhatsApp</SectionLabel>
          <p className="text-xs text-muted">Se o assistente não responde no WhatsApp ou o código de vínculo não confirma, comece por aqui.</p>
        </div>
        <Button variant="secondary" size="sm" loading={pending} onClick={run}>Conferir agora</Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {data && (
        <div className="flex flex-col gap-3 text-sm">
          <ul className="flex flex-col gap-1.5">
            {signals.map(([label, s]) => (
              <Line key={label} ok={s ? s.ok : false}>
                <strong>{label}:</strong> {s ? `${s.result} (${ago(s.at)})${s.detail ? ` · ${s.detail}` : ""}` : "nada ainda. Nenhuma mensagem chegou ao sistema desde que o diagnóstico existe."}
              </Line>
            ))}
          </ul>
          <ul className="flex flex-col gap-1.5">
            <Line ok={null}>Endereço do app que a UAZAPI precisa usar: <span className="break-all font-mono">{data.check.expectedWebhook}</span></Line>
            {data.check.provider === "uazapi" && u && (
              <>
                <Line ok={u.reachable && u.connected === true ? true : false}>
                  {u.reachable ? `Instância da UAZAPI: ${u.connected ? "conectada" : `DESCONECTADA${u.state ? ` (${u.state})` : ""}. Leia o QR code de novo no painel da UAZAPI`}${u.number ? `, número ${u.number}` : ""}` : u.error}
                </Line>
                {u.reachable && u.error && <Line ok={false}>{u.error}</Line>}
                {u.reachable && hooks.length === 0 && !u.error && <Line ok={false}>A UAZAPI não tem nenhum webhook cadastrado: ela não avisa o app das mensagens. Cadastre o endereço que aparece em Endereços para colar nos serviços.</Line>}
                {hooks.map((h) => (
                  <Line key={h.url} ok={h.pointsHere && h.secretOk}>
                    Webhook cadastrado na UAZAPI: <span className="break-all font-mono">{h.url.replace(/secret=[^&]+/, "secret=…")}</span>
                    {h.pointsHere ? (h.secretOk ? " — confere com este app" : " — o endereço é este app, mas o segredo não é o do sistema") : " — aponta para OUTRO endereço (domínio antigo?). Troque pelo de cima"}
                    {h.enabled === false ? " (desligado)" : ""}
                  </Line>
                ))}
                {u.reachable && hooks.length > 0 && !good && !hooks.some((h) => h.pointsHere) && <Line ok={false}>Nenhum webhook aponta para este app. Foi o que mais travou o WhatsApp depois de trocar o domínio.</Line>}
              </>
            )}
            <Line ok={data.check.queue.token && data.check.queue.signingKeys}>
              Fila (QStash): {data.check.queue.token ? "chave de envio presente" : "sem QSTASH_TOKEN"}; {data.check.queue.signingKeys ? "chaves de assinatura presentes" : "faltam QSTASH_CURRENT_SIGNING_KEY e QSTASH_NEXT_SIGNING_KEY (sem elas a fila recusa toda mensagem)"}. A fila chama {data.check.site}/api/jobs/process-inbound: o endereço do app (SITE_URL no stack) precisa ser o domínio atual.
            </Line>
            <Line ok={data.check.botNumber ? null : false}>Número do assistente (o que recebe o código): {data.check.botNumber ?? "não configurado (WHATSAPP_BOT_NUMBER)"}</Line>
          </ul>
        </div>
      )}
    </Card>
  );
}
