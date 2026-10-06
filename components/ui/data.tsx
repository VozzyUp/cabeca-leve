import type { ReactNode } from "react";
import { cn } from "./cn";

type MetricProps = { label: string; value: string; hint?: string; tone?: "neutral" | "income" | "expense" };

// Número em destaque (sobra do mês, peso, total)
export function Metric({ label, value, hint, tone = "neutral" }: MetricProps) {
  const color = { neutral: "text-text", income: "text-income", expense: "text-expense" }[tone];
  return (
    <div className="flex flex-col gap-1">
      <p className="text-label text-muted">{label}</p>
      <p className={cn("text-metric", color)}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

type ProgressProps = { label: string; value: number; max: number; display?: string };

export function Progress({ label, value, max, display }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-body">{label}</span>
        <span className="font-mono text-muted">{display ?? `${Math.round(pct)}%`}</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
        className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type CheckItemProps = {
  title: string;
  meta?: string;
  done: boolean;
  overdue?: boolean;
  onToggle: () => void;
};

// Item com caixa de marcar (tarefa, lembrete, hábito)
export function CheckItem({ title, meta, done, overdue = false, onToggle }: CheckItemProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 hover:bg-surface-2">
      <input type="checkbox" checked={done} onChange={onToggle} className="mt-0.5 size-4 accent-[var(--c-accent)]" />
      <span className="flex min-w-0 flex-col">
        <span className={cn("truncate text-sm", done ? "text-muted line-through" : "text-text")}>{title}</span>
        {meta && <span className={cn("text-xs", overdue && !done ? "text-warning" : "text-muted")}>{overdue && !done ? `Atrasado · ${meta}` : meta}</span>}
      </span>
    </label>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <span aria-hidden className="text-muted">{icon}</span>
      <p className="text-sm font-semibold text-text">{title}</p>
      <p className="max-w-xs text-sm text-muted">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Toast({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-4 rounded-md bg-surface-3 px-4 py-3 text-sm text-text shadow-pop">
      <span>{children}</span>
      {action}
    </div>
  );
}
