"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { generateSystemSecret, revealIntegrationInfo, saveSystemConfig, testAnthropicKey } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import type { ConfigGroup, FieldStatus } from "@/lib/app-config";

const SOURCE = { banco: "salvo aqui", stack: "vem do stack", faltando: "não configurado" } as const;

function FieldRow({ field, status, value, onChange, onClear, onGenerate, busy }: {
  field: ConfigGroup["fields"][number]; status?: FieldStatus; value: string; onChange: (v: string) => void;
  onClear: () => void; onGenerate: () => void; busy: boolean;
}) {
  const id = useId();
  const tone = status?.source === "faltando" ? "text-warning" : "text-muted";
  return (
    <div className="flex flex-col gap-1.5 border-b border-border py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-text">{field.label}</label>
        <span className={`text-xs ${tone}`}>
          {SOURCE[status?.source ?? "faltando"]}{status?.preview ? `: ${status.preview}` : ""}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {field.options ? (
          <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-3 text-sm text-text">
            <option value="">{status?.preview ? "manter como está" : "escolha…"}</option>
            {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
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
                try { const r = await testAnthropicKey(); setMessage(r.ok ? { ok: true, text: "A chave funciona." } : { ok: false, text: r.message }); }
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
