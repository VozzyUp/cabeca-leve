"use client";
import { X } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import type { BudgetStatus } from "@/lib/domain/finance";
import { formatMoney } from "@/lib/time";
import { cn } from "@/components/ui/cn";
import { parseMoneyInput } from "./goal-progress-form";

const LEVEL = {
  ok: { bar: "bg-success", text: "text-body", label: "dentro do teto" },
  near: { bar: "bg-warning", text: "text-warning", label: "perto do teto" },
  over: { bar: "bg-danger", text: "text-danger", label: "passou do teto" },
} as const;

type Cat = { id: string; name: string; parentId: string | null };

// F5: teto de gastos por categoria, com o quanto já foi e o quanto falta
export function BudgetsCard({ budgets, categories, onChange }: { budgets: BudgetStatus[]; categories: Cat[]; onChange: () => void }) {
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const label = (c: Cat) => (c.parentId ? `${names.get(c.parentId)} › ${c.name}` : c.name);
  const options = [...categories].sort((a, b) => label(a).localeCompare(label(b), "pt-BR"));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseMoneyInput(amount);
    if (!categoryId) { setError("Escolha a categoria."); return; }
    if (!cents || cents <= 0) { setError("Use um valor como 500 ou 450,90."); return; }
    setError(null); setBusy(true);
    try { await api.setBudget(categoryId, cents); setAmount(""); setCategoryId(""); onChange(); }
    catch { setError("Não deu para salvar o teto. Tente de novo."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    try { await api.setBudget(id, null); onChange(); } catch { setError("Não deu para tirar o teto. Tente de novo."); }
  }

  return (
    <Card className="flex flex-col gap-4">
      <SectionLabel>Tetos do mês</SectionLabel>
      {budgets.length === 0 && <p className="text-sm text-body">Defina quanto quer gastar por mês numa categoria. Avisamos quando passar de 80% e de 100%.</p>}
      {budgets.length > 0 && (
        <ul className="flex flex-col gap-4">
          {budgets.map((b) => {
            const pct = Math.round(b.ratio * 100);
            const left = b.limitCents - b.spentCents;
            return (
              <li key={b.categoryId} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-text">{b.name}</span>
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-text">{formatMoney(b.spentCents)} de {formatMoney(b.limitCents)}</span>
                    <IconButton size="sm" label={`Tirar teto de ${b.name}`} onClick={() => remove(b.categoryId)}><X className="size-4" /></IconButton>
                  </span>
                </div>
                <div role="progressbar" aria-label={`Teto de ${b.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(pct, 100)}
                  aria-valuetext={`${pct}%, ${LEVEL[b.level].label}`} className="h-2 overflow-hidden rounded-full bg-surface-3">
                  <div className={cn("h-full rounded-full", LEVEL[b.level].bar)} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
                </div>
                <p className={cn("text-xs", LEVEL[b.level].text)}>
                  {pct}% · {left >= 0 ? `faltam ${formatMoney(left)}` : `passou ${formatMoney(-left)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="teto-categoria" className="text-sm font-medium text-body">Categoria</label>
          <select id="teto-categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="h-10 rounded-md border border-border-input bg-bg px-3 text-sm text-text">
            <option value="">Escolha…</option>
            {options.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
          </select>
        </div>
        <Field label="Teto por mês (R$)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
        <Button type="submit" variant="secondary" loading={busy}>Definir teto</Button>
        {error && <p role="alert" className="text-xs text-danger sm:col-span-3">{error}</p>}
      </form>
    </Card>
  );
}
