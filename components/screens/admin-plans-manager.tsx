"use client";
import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminDeletePlan, adminSavePlan, adminSaveTrial } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { centsToInput, monthsText, MONTHS_OPTIONS, parseMoneyToCents, planPeriod, storageText, TRIAL_DAYS, waText, type Plan } from "@/lib/plans";
import { formatMoney } from "@/lib/time";

export type ManagedPlan = Plan & { used: number; activeSubs: number };

const select = "h-10 rounded-md border border-border-input bg-bg px-3 text-sm text-text disabled:opacity-60";
type Form = { name: string; tagline: string; price: string; months: string; recurring: string; whatsapp: string; messages: string; storage: string; sort: string; active: boolean; featured: boolean };

const blank = (sort: number): Form => ({ name: "", tagline: "", price: "", months: "1", recurring: "true", whatsapp: "2", messages: "200", storage: "2048", sort: String(sort), active: true, featured: false });
const fromPlan = (p: Plan): Form => ({
  name: p.name, tagline: p.tagline ?? "", price: centsToInput(p.priceCents), months: String(p.months), recurring: String(p.recurring), whatsapp: String(p.whatsappLimit),
  messages: String(p.messagesPerDay), storage: String(p.storageMb), sort: String(p.sort), active: p.active, featured: p.featured,
});
const whole = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN);

// Planos e limites: o que cada plano custa e quanto deixa usar. Mexer aqui vale na hora, sem publicar nada.
export function PlansManager({ plans }: { plans: ManagedPlan[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<ManagedPlan | "new" | null>(null);
  const [form, setForm] = useState<Form>(blank(10));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ManagedPlan | null>(null);

  const isTrial = editing !== null && editing !== "new" && editing.kind === "trial";
  const locked = editing !== null && editing !== "new" && editing.used > 0;  // já tem assinatura: duração e cobrança ficam
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  function open(p: ManagedPlan | "new") {
    setError(null); setNotice(null);
    setForm(p === "new" ? blank(Math.max(0, ...plans.map((x) => x.sort)) + 10) : fromPlan(p));
    setEditing(p);
  }

  function save() {
    if (!editing) return;
    const whatsappLimit = whole(form.whatsapp), messagesPerDay = whole(form.messages), storageMb = whole(form.storage);
    if ([whatsappLimit, messagesPerDay, storageMb].some(Number.isNaN)) { setError("WhatsApps, mensagens e espaço são números inteiros."); return; }
    setError(null);
    start(async () => {
      try {
        let r;
        if (isTrial) r = await adminSaveTrial({ whatsappLimit, messagesPerDay, storageMb });
        else {
          const priceCents = parseMoneyToCents(form.price);
          const sort = whole(form.sort);
          if (priceCents === null || Number.isNaN(sort)) { setError("Confira o preço (ex.: 39,90) e a ordem."); return; }
          r = await adminSavePlan({
            id: editing === "new" ? null : editing.id, name: form.name, tagline: form.tagline.trim() || null, priceCents, months: Number(form.months) as 1 | 3 | 6 | 12,
            recurring: form.recurring === "true", whatsappLimit, messagesPerDay, storageMb, featured: form.featured, active: form.active, sort,
          });
        }
        if (r.ok) {
          setNotice(editing === "new" ? `Plano ${form.name.trim()} criado.` : "Alterações salvas.");
          setEditing(null);
          router.refresh();
        } else setError(r.error);
      } catch { setError("Não deu para salvar. Tente de novo."); }
    });
  }

  function remove(p: ManagedPlan) {
    start(async () => {
      try {
        const r = await adminDeletePlan(p.id);
        if (r.ok) { setNotice(`Plano ${p.name} excluído.`); setDeleting(null); router.refresh(); }
        else { setDeleting(null); setError(r.error); }
      } catch { setDeleting(null); setError("Não deu para excluir. Tente de novo."); }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-body">
          Limites e preço valem na hora para o que for contratado daqui para frente; os limites também valem para quem já tem o plano.
          Quem já paga uma assinatura que renova no cartão continua com o valor antigo, que a Asaas guarda.
        </p>
        <Button icon={<Plus className="size-4" />} onClick={() => open("new")}>Novo plano</Button>
      </div>
      {notice && <p role="status" className="text-sm text-success">{notice}</p>}
      {error && !editing && <p role="alert" className="text-sm text-danger">{error}</p>}

      <ul className="flex flex-col gap-3" aria-label="Planos">
        {plans.map((p) => (
          <li key={p.id}>
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-text">{p.name}</h2>
                    {p.kind === "trial" ? <Badge>Não se vende</Badge> : p.active ? <Badge tone="ok">À venda</Badge> : <Badge>Fora de venda</Badge>}
                    {p.featured && p.kind === "paid" && <Badge tone="ok">Destaque</Badge>}
                  </div>
                  <p className="text-sm text-body">
                    {p.kind === "trial" ? `${TRIAL_DAYS} dias, sem cartão` : <><span className="font-mono text-text">{formatMoney(p.priceCents)}</span> {planPeriod(p)} · {p.recurring ? "renova sozinho no cartão" : "pagamento único (Pix ou cartão)"}{p.months > 1 ? ` · vale ${monthsText(p.months)}` : ""}</>}
                  </p>
                </div>
                <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} aria-label={`Editar ${p.name}`} onClick={() => open(p)}>Editar</Button>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-body">
                <li>{waText(p.whatsappLimit, true)}</li>
                <li>{p.messagesPerDay.toLocaleString("pt-BR")} mensagens por dia</li>
                <li>{storageText(p.storageMb)} para documentos</li>
              </ul>
              {p.kind === "paid" && <p className="text-xs text-muted">{p.used === 0 ? "Nenhuma assinatura ainda." : `${p.activeSubs} ${p.activeSubs === 1 ? "assinatura valendo" : "assinaturas valendo"} · ${p.used} no total`}</p>}
            </Card>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Novo plano" : isTrial ? "Limites do teste grátis" : `Editar ${editing?.name ?? ""}`}>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {!isTrial && (
            <>
              <Field label="Nome" value={form.name} maxLength={40} onChange={(e) => set("name", e.target.value)} />
              <Field label="Frase curta (opcional)" value={form.tagline} maxLength={140} hint="Aparece embaixo do preço, na página de planos." onChange={(e) => set("tagline", e.target.value)} />
              <Field label="Preço (R$)" inputMode="decimal" value={form.price} placeholder="39,90" onChange={(e) => set("price", e.target.value)} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="plano-duracao" className="text-sm font-medium text-body">Duração</label>
                  <select id="plano-duracao" className={select} value={form.months} disabled={locked} onChange={(e) => set("months", e.target.value)}>
                    {MONTHS_OPTIONS.map((m) => <option key={m} value={m}>{monthsText(m)}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="plano-cobranca" className="text-sm font-medium text-body">Cobrança</label>
                  <select id="plano-cobranca" className={select} value={form.recurring} disabled={locked} onChange={(e) => set("recurring", e.target.value)}>
                    <option value="true">Renova sozinho no cartão</option>
                    <option value="false">Pagamento único (Pix ou cartão)</option>
                  </select>
                </div>
              </div>
              {locked && <p className="text-xs text-muted">Este plano já tem assinaturas: duração e cobrança não mudam. Para mudar, crie um plano novo e tire este da venda.</p>}
            </>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="WhatsApps na conta" inputMode="numeric" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
            <Field label="Mensagens por dia" inputMode="numeric" value={form.messages} onChange={(e) => set("messages", e.target.value)} />
            <Field label="Espaço para documentos (MB)" inputMode="numeric" value={form.storage} hint={Number.isNaN(whole(form.storage)) ? undefined : storageText(whole(form.storage))} onChange={(e) => set("storage", e.target.value)} />
          </div>
          {!isTrial && (
            <>
              <Field label="Ordem na lista" inputMode="numeric" value={form.sort} hint="Menor aparece primeiro." className="max-w-40" onChange={(e) => set("sort", e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-body"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={form.active} onChange={(e) => set("active", e.target.checked)} />À venda</label>
              <label className="flex items-center gap-2 text-sm text-body"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} />Destaque na página de planos</label>
            </>
          )}
          {isTrial && <p className="text-xs text-muted">O teste dura {TRIAL_DAYS} dias para todo mundo e não tem preço. Aqui só mudam os limites.</p>}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>{editing && editing !== "new" && editing.kind === "paid" && editing.used === 0 && <Button type="button" variant="danger" onClick={() => { setDeleting(editing); setEditing(null); }}>Excluir plano</Button>}</div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" loading={pending}>Salvar</Button>
            </div>
          </div>
        </form>
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Excluir o plano">
        <p className="text-sm text-body">Excluir o plano <strong className="text-text">{deleting?.name}</strong>? Ele nunca teve assinaturas, então some sem deixar rastro. Não tem volta.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Voltar</Button>
          <Button variant="danger" loading={pending} onClick={() => deleting && remove(deleting)}>Excluir para sempre</Button>
        </div>
      </Dialog>
    </div>
  );
}

function Badge({ children, tone = "off" }: { children: React.ReactNode; tone?: "ok" | "off" }) {
  return <span className={tone === "ok" ? "rounded-full border border-success px-2 py-0.5 text-xs font-medium text-success" : "rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted"}>{children}</span>;
}
