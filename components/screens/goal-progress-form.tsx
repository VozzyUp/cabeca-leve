"use client";
import { useState, useTransition } from "react";
import { addGoalProgress } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Goal } from "@/lib/data/types";

// "1.234,56" -> 123456 centavos; aceita também "1234.56" e "50"
export function parseMoneyInput(text: string): number | null {
  const t = text.trim().replace(/^R\$\s*/i, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(t)) return null;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return Math.round(Number(normalized) * 100);
}

// Registrar avanço numa meta (aporte em dinheiro ou quantidade)
export function GoalProgressForm({ goalId, unit, title }: { goalId: string; unit: Goal["unit"]; title: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = `goal-${goalId}`;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const delta = unit === "money" ? parseMoneyInput(value) : /^\d+$/.test(value.trim()) ? Number(value) : null;
    if (!delta) { setError(unit === "money" ? "Digite um valor, como 150 ou 1.200,50." : "Digite um número inteiro."); return; }
    setError(null);
    start(async () => {
      try { await addGoalProgress(goalId, delta); setValue(""); } catch { setError("Não deu para salvar. Tente de novo."); }
    });
  }
  return (
    <form onSubmit={submit} className="mt-auto flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">{unit === "money" ? `Valor guardado para ${title}` : `Quantidade para ${title}`}</label>
      <div className="flex gap-2">
        <input id={id} inputMode={unit === "money" ? "decimal" : "numeric"} value={value} onChange={(e) => setValue(e.target.value)}
          placeholder={unit === "money" ? "R$ guardado agora" : "quantos a mais"} aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className="h-10 min-w-0 flex-1 rounded-md border border-border-input bg-bg px-3 text-sm text-text placeholder:text-muted aria-[invalid=true]:border-danger" />
        <Button type="submit" variant="secondary" loading={pending}>Registrar</Button>
      </div>
      {error && <p id={`${id}-err`} className="text-xs text-danger">{error}</p>}
    </form>
  );
}
