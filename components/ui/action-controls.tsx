"use client";
import { useOptimistic, useState, useTransition, type ComponentProps } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { CheckItem } from "./data";

const SaveError = () => <span role="alert" className="text-xs text-danger">Não deu para salvar. Tente de novo.</span>;

// Botão que chama uma ação de servidor, com carregamento e erro no lugar
export function ActionButton({ action, ...rest }: Omit<ComponentProps<typeof Button>, "onClick"> & { action: () => Promise<unknown> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button {...rest} loading={pending} onClick={() => start(async () => {
        setError(false);
        try { await action(); } catch { setError(true); }
      })} />
      {error && <SaveError />}
    </span>
  );
}

// Caixa de marcar que muda na hora e volta sozinha se o servidor recusar
export function ActionCheck({ checked, action, title, meta }: {
  checked: boolean; action: (done: boolean) => Promise<unknown>; title: string; meta?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [error, setError] = useState(false);
  const [, start] = useTransition();
  return (
    <div>
      <CheckItem title={title} meta={meta} done={optimistic} onToggle={() => start(async () => {
        const next = !optimistic;
        setOptimistic(next);
        setError(false);
        try { await action(next); } catch { setError(true); }
      })} />
      {error && <div className="px-2"><SaveError /></div>}
    </div>
  );
}

// Interruptor liga/desliga (pausar um fixo, ativar uma revisão)
export function ActionSwitch({ checked, action, label }: { checked: boolean; action: (on: boolean) => Promise<unknown>; label: string }) {
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [error, setError] = useState(false);
  const [, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" role="switch" aria-checked={optimistic} aria-label={label}
        onClick={() => start(async () => {
          const next = !optimistic;
          setOptimistic(next);
          setError(false);
          try { await action(next); } catch { setError(true); }
        })}
        className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", optimistic ? "bg-accent" : "bg-surface-3")}>
        <span aria-hidden className={cn("absolute top-0.5 size-5 rounded-full transition-[left] duration-150", optimistic ? "left-[18px] bg-on-accent" : "left-0.5 bg-muted")} />
      </button>
      {error && <SaveError />}
    </span>
  );
}
