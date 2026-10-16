"use client";
import { Check, Copy, Loader2, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { payPlan } from "@/app/actions";
import type { AttemptInfo } from "@/lib/billing/asaas";
import { isCep, isCpfCnpj, isCvv, isPhone, luhnOk, maskCard, maskCep, maskCpfCnpj, maskExpiry, maskPhone, parseExpiry } from "@/lib/br-docs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";
import { PageHeader } from "@/components/ui/load-error";
import { methodHint, METHOD_NAME, PAY_METHODS, planPeriod, type PayMethod, type Plan } from "@/lib/plans";
import { formatMoney } from "@/lib/time";

type Form = { name: string; cpfCnpj: string; phone: string; postalCode: string; addressNumber: string; holderName: string; number: string; expiry: string; ccv: string };
type Errors = Partial<Record<keyof Form, string>>;
type Outcome =
  | { kind: "paid"; method: PayMethod }
  | { kind: "waiting"; method: PayMethod; id: string; info: AttemptInfo }
  | { kind: "failed"; message: string };

const SUBMIT: Record<PayMethod, string> = { pix: "Gerar Pix", boleto: "Gerar boleto", card: "Pagar com cartão" };

function validate(method: PayMethod, f: Form): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 3) e.name = "Digite o nome completo.";
  if (!isCpfCnpj(f.cpfCnpj)) e.cpfCnpj = "CPF ou CNPJ inválido.";
  if (!isPhone(f.phone)) e.phone = "Celular inválido. Use o DDD.";
  if (method === "card") {
    if (!isCep(f.postalCode)) e.postalCode = "CEP inválido.";
    if (!f.addressNumber.trim()) e.addressNumber = "Digite o número.";
    if (f.holderName.trim().length < 3) e.holderName = "Digite o nome como está no cartão.";
    if (!luhnOk(f.number)) e.number = "Número do cartão inválido.";
    if (!parseExpiry(f.expiry)) e.expiry = "Validade inválida ou vencida.";
    if (!isCvv(f.ccv)) e.ccv = "Código inválido.";
  }
  return e;
}

// Copiar o código do Pix ou a linha do boleto
function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-body">{label}</p>
      <p className="break-all rounded-md border border-border bg-surface-2 p-3 font-mono text-xs text-text">{value}</p>
      <Button variant="secondary" icon={copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
        onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* sem permissão: a pessoa copia o texto acima */ } }}>
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

// Espera a confirmação do Pix ou do boleto (o webhook libera o plano) e avisa na tela
function Waiting({ outcome, onPaid, onFailed }: { outcome: Extract<Outcome, { kind: "waiting" }>; onPaid: () => void; onFailed: (message: string) => void }) {
  const { id, method, info } = outcome;
  const callbacks = useRef({ onPaid, onFailed });
  useEffect(() => { callbacks.current = { onPaid, onFailed }; });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = await fetch(`/api/billing/attempt?id=${encodeURIComponent(id)}`).then((x) => x.json()).catch(() => null) as { status?: string; failure?: string } | null;
      if (!alive) return;
      if (r?.status === "paid") return callbacks.current.onPaid();
      if (r?.status === "failed" || r?.status === "canceled") return callbacks.current.onFailed(r.failure ?? "O pagamento não foi concluído.");
      setTimeout(tick, 3000);
    };
    const timer = setTimeout(tick, 3000);
    return () => { alive = false; clearTimeout(timer); };
  }, [id]);
  return (
    <div className="flex flex-col gap-4">
      <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-body">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        {method === "pix" ? "Aguardando o pagamento do Pix. Assim que cair, esta tela avisa." : "Boleto gerado. Quando o banco confirmar o pagamento, esta tela avisa."}
      </div>
      {info.pix && (
        <>
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR code em base64 vindo da cobrança */}
            <img src={`data:image/png;base64,${info.pix.image}`} alt="QR code do Pix" width={220} height={220} className="rounded-md border border-border bg-white p-2" />
            <p className="text-xs text-muted">Abra o app do seu banco, escolha pagar com Pix e leia o QR code.</p>
          </div>
          <CopyBox label="Ou copie o código Pix (copia e cola)" value={info.pix.payload} />
        </>
      )}
      {info.boleto && (
        <>
          <CopyBox label="Linha digitável do boleto" value={info.boleto.line} />
          {info.boleto.url && <a href={info.boleto.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-text hover:bg-surface-2">Baixar o boleto (PDF)</a>}
          <p className="text-xs text-muted">Vence em {info.dueDate.split("-").reverse().join("/")}. Depois de pagar, o banco leva de 1 a 2 dias úteis para confirmar.</p>
        </>
      )}
    </div>
  );
}

export function CheckoutScreen({ plan, name, trialEndsOn }: { plan: Plan; name: string; trialEndsOn: string | null }) {
  const router = useRouter();
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [step, setStep] = useState<"method" | "data" | "result">("method");
  const [form, setForm] = useState<Form>({ name, cpfCnpj: "", phone: "", postalCode: "", addressNumber: "", holderName: "", number: "", expiry: "", ccv: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);

  // leva o foco ao título da etapa nova (teclado e leitor de tela)
  useEffect(() => { heading.current?.focus(); }, [step]);

  const set = (k: keyof Form, mask?: (t: string) => string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: mask ? mask(e.target.value) : e.target.value }));
  const paid = (m: PayMethod) => { setOutcome({ kind: "paid", method: m }); setStep("result"); setForm((f) => ({ ...f, number: "", ccv: "", expiry: "" })); router.refresh(); };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!method) return;
    const err = validate(method, form);
    setErrors(err);
    setServerError(null);
    if (Object.keys(err).length) return;
    start(async () => {
      const r = await payPlan({
        plan: plan.id, method, name: form.name, cpfCnpj: form.cpfCnpj, phone: form.phone,
        ...(method === "card" ? { postalCode: form.postalCode, addressNumber: form.addressNumber, card: { holderName: form.holderName, number: form.number, expiry: form.expiry, ccv: form.ccv } } : {}),
      });
      if (!r.ok) { setServerError(r.error); return; }
      if (r.status === "paid") return paid(method);
      setOutcome({ kind: "waiting", method, id: r.attemptId, info: r.info });
      setStep("result");
    });
  }

  const money = formatMoney(plan.priceCents);
  const trialNote = trialEndsOn && method === "card" && plan.recurring ? `A primeira cobrança é no fim do teste grátis, em ${trialEndsOn.split("-").reverse().join("/")}.` : null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <PageHeader id="S43" title={`Assinar o plano ${plan.name.toLowerCase()}`} />
      <Card className="flex flex-wrap items-baseline justify-between gap-2 p-4">
        <span className="text-sm text-body">Plano {plan.name.toLowerCase()}</span>
        <span><span className="font-mono text-2xl font-semibold text-text">{money}</span> <span className="text-sm text-muted">{planPeriod(plan)}</span></span>
      </Card>

      {step === "method" && (
        <form onSubmit={(e) => { e.preventDefault(); if (method) setStep("data"); }} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-base font-semibold text-text"><h2 ref={heading} tabIndex={-1} className="outline-none">Como você quer pagar?</h2></legend>
            {PAY_METHODS.map((m) => (
              <label key={m} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-4 has-[:checked]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus", method === m ? "border-accent" : "border-border")}>
                <input type="radio" name="metodo" value={m} checked={method === m} onChange={() => setMethod(m)} className="mt-1 size-4 accent-[var(--color-accent)]" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-text">{METHOD_NAME[m]}</span>
                  <span className="text-xs text-muted">{methodHint(plan, m)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Button type="submit" size="lg" disabled={!method}>Continuar</Button>
          <Link href="/ajustes/plano" className="text-center text-sm font-medium text-accent hover:underline">Voltar para os planos</Link>
        </form>
      )}

      {step === "data" && method && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <h2 ref={heading} tabIndex={-1} className="text-base font-semibold text-text outline-none">{method === "card" ? "Dados do cartão" : `Seus dados para o ${METHOD_NAME[method]}`}</h2>
          <p className="text-sm text-muted">{METHOD_NAME[method]}: {methodHint(plan, method)}</p>
          <Field label="Nome completo" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CPF ou CNPJ" inputMode="numeric" autoComplete="off" value={form.cpfCnpj} onChange={set("cpfCnpj", maskCpfCnpj)} error={errors.cpfCnpj} hint="Exigido para emitir a cobrança." />
            <Field label="Celular" type="tel" inputMode="tel" autoComplete="tel-national" value={form.phone} onChange={set("phone", maskPhone)} error={errors.phone} />
          </div>
          {method === "card" && (
            <>
              <Field label="Número do cartão" inputMode="numeric" autoComplete="cc-number" value={form.number} onChange={set("number", maskCard)} error={errors.number} />
              <Field label="Nome no cartão" autoComplete="cc-name" value={form.holderName} onChange={set("holderName")} error={errors.holderName} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Validade (MM/AA)" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={form.expiry} onChange={set("expiry", maskExpiry)} error={errors.expiry} />
                <Field label="Código de segurança" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={form.ccv} onChange={set("ccv", (t) => t.replace(/\D/g, "").slice(0, 4))} error={errors.ccv} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="CEP" inputMode="numeric" autoComplete="postal-code" value={form.postalCode} onChange={set("postalCode", maskCep)} error={errors.postalCode} />
                <Field label="Número do endereço" autoComplete="off" value={form.addressNumber} onChange={set("addressNumber")} error={errors.addressNumber} />
              </div>
              {trialNote && <p className="text-xs text-muted">{trialNote}</p>}
            </>
          )}
          {serverError && <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">{serverError}</p>}
          <Button type="submit" size="lg" loading={pending}>{SUBMIT[method]} · {money}</Button>
          <button type="button" onClick={() => { setStep("method"); setServerError(null); }} className="text-sm font-medium text-accent hover:underline">Escolher outra forma de pagar</button>
          <p className="flex items-center gap-2 text-xs text-muted"><ShieldCheck aria-hidden className="size-4 shrink-0" />Pagamento seguro. {method === "card" ? "Os dados do cartão são enviados direto para o processamento do pagamento e não ficam guardados." : "Nada é cobrado além do valor acima."}</p>
        </form>
      )}

      {step === "result" && outcome && (
        <div className="flex flex-col gap-4">
          {outcome.kind === "paid" && (
            <div role="status" className="flex flex-col gap-3 rounded-lg border border-success bg-surface p-5">
              <h2 ref={heading} tabIndex={-1} className="flex items-center gap-2 text-xl font-bold text-text outline-none"><Check aria-hidden className="size-5 text-success" />Pagamento aprovado</h2>
              <p className="text-sm text-body">Seu plano {plan.name.toLowerCase()} está ativo. Obrigado!{plan.recurring && outcome.method === "card" ? " Você pode cancelar quando quiser em Meu plano." : ""}</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/conversa" className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-on-accent">Ir para o assistente</Link>
                <Link href="/ajustes/plano" className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-text hover:bg-surface-2">Ver meu plano</Link>
              </div>
            </div>
          )}
          {outcome.kind === "waiting" && (
            <>
              <h2 ref={heading} tabIndex={-1} className="flex items-center gap-2 text-xl font-bold text-text outline-none">{outcome.method === "pix" && <QrCode aria-hidden className="size-5" />}{outcome.method === "pix" ? "Pague com Pix" : "Boleto gerado"}</h2>
              <Waiting outcome={outcome} onPaid={() => paid(outcome.method)} onFailed={(message) => { setOutcome({ kind: "failed", message }); }} />
            </>
          )}
          {outcome.kind === "failed" && (
            <div role="alert" className="flex flex-col gap-3 rounded-lg border border-danger bg-surface p-5">
              <h2 ref={heading} tabIndex={-1} className="text-xl font-bold text-text outline-none">O pagamento não foi concluído</h2>
              <p className="text-sm text-body">{outcome.message}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { setOutcome(null); setStep("method"); }}>Tentar de novo</Button>
                <Link href="/ajustes/suporte" className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-text hover:bg-surface-2">Falar com uma pessoa</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
