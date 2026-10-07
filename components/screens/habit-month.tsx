"use client";
import { useOptimistic, useState, useTransition } from "react";
import { setHabitDay } from "@/app/actions";
import { cn } from "@/components/ui/cn";

type Cell = { day: string; scheduled: boolean; done: boolean; future: boolean; inMonth: boolean };
const label = (day: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));

// Mês de um hábito: cada dia planejado é um botão que marca ou desmarca (inclusive dias anteriores)
export function HabitMonth({ habitId, title, cells }: { habitId: string; title: string; cells: Cell[] }) {
  const [optimistic, toggle] = useOptimistic(cells, (state, day: string) => state.map((c) => (c.day === day ? { ...c, done: !c.done } : c)));
  const [error, setError] = useState(false);
  const [, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-text">{title}</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i} aria-hidden className="text-label text-muted">{d}</span>)}
        {optimistic.map((c) => !c.inMonth ? <span key={c.day} aria-hidden /> : (
          <button key={c.day} type="button" disabled={!c.scheduled || c.future} aria-pressed={c.done}
            aria-label={`${label(c.day)}: ${c.done ? "feito" : c.scheduled ? "não feito" : "não planejado"}`}
            onClick={() => start(async () => {
              toggle(c.day);
              setError(false);
              try { await setHabitDay(habitId, c.day, !c.done); } catch { setError(true); }
            })}
            className={cn("flex aspect-square items-center justify-center rounded-md font-mono text-xs transition-colors",
              c.done ? "bg-accent text-on-accent" : c.scheduled && !c.future ? "bg-surface-2 text-body hover:bg-surface-3" : "text-muted opacity-50")}>
            {Number(c.day.slice(8))}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-xs text-danger">Não deu para salvar. Tente de novo.</p>}
    </div>
  );
}
