"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/components/ui/cn";
import { Segmented } from "@/components/ui/segmented";
import { addDays, capitalizeFirst, formatMonth } from "@/lib/time";

export type CalendarItem = { id: string; day: string; time: string | null; title: string; source: Source; href: string };
type Source = "agenda" | "tarefas" | "lembretes" | "contas";

const SOURCES: Array<{ id: Source; label: string; dot: string }> = [
  { id: "agenda", label: "Agenda", dot: "bg-info" },
  { id: "tarefas", label: "Tarefas", dot: "bg-accent" },
  { id: "lembretes", label: "Lembretes", dot: "bg-warning" },
  { id: "contas", label: "Contas", dot: "bg-expense" },
];
const DOT = Object.fromEntries(SOURCES.map((s) => [s.id, s.dot])) as Record<Source, string>;
const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const longDay = (day: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));

// S06: mês ou semana com todas as fontes juntas. Setas navegam entre os dias.
export function CalendarView({ items, today }: { items: CalendarItem[]; today: string }) {
  const [view, setView] = useState<"month" | "week">("month");
  const [selected, setSelected] = useState(today);
  const [hidden, setHidden] = useState<Set<Source>>(new Set());
  const gridRef = useRef<HTMLDivElement>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const i of items) if (!hidden.has(i.source)) m.set(i.day, [...(m.get(i.day) ?? []), i]);
    for (const list of m.values()) list.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
    return m;
  }, [items, hidden]);

  const month = selected.slice(0, 7);
  // dias exibidos: o mês inteiro em semanas completas, ou só a semana do dia escolhido
  const days = useMemo(() => {
    if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(selected, i - weekday(selected)));
    const first = `${month}-01`;
    const start = addDays(first, -weekday(first));
    const out: string[] = [];
    for (let d = start; out.length < 42; d = addDays(d, 1)) {
      if (out.length % 7 === 0 && out.length >= 28 && d.slice(0, 7) !== month) break;
      out.push(d);
    }
    return out;
  }, [view, selected, month]);

  function move(to: string) {
    setSelected(to);
    // o foco acompanha o dia escolhido depois de redesenhar
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${to}"]`)?.focus());
  }
  function onKey(e: KeyboardEvent) {
    const delta: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    if (e.key in delta) { e.preventDefault(); move(addDays(selected, delta[e.key])); }
    else if (e.key === "Home") { e.preventDefault(); move(addDays(selected, -weekday(selected))); }
    else if (e.key === "End") { e.preventDefault(); move(addDays(selected, 6 - weekday(selected))); }
  }
  const shift = (dir: number) => {
    if (view === "week") return setSelected(addDays(selected, dir * 7));
    const [y, m] = month.split("-").map(Number);
    setSelected(new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10));
  };
  const selectedItems = byDay.get(selected) ?? [];
  const toggleSource = (s: Source) => setHidden((h) => { const n = new Set(h); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton label={view === "week" ? "Semana anterior" : "Mês anterior"} onClick={() => shift(-1)}><ChevronLeft className="size-5" /></IconButton>
          <p aria-live="polite" className="min-w-40 text-center text-sm font-medium text-text">{capitalizeFirst(formatMonth(month))}</p>
          <IconButton label={view === "week" ? "Próxima semana" : "Próximo mês"} onClick={() => shift(1)}><ChevronRight className="size-5" /></IconButton>
          {selected !== today && <button type="button" onClick={() => setSelected(today)} className="ml-2 text-sm font-medium text-accent hover:underline">Hoje</button>}
        </div>
        <Segmented label="Visão" value={view} onChange={setView} options={[{ value: "month", label: "Mês" }, { value: "week", label: "Semana" }]} />
      </div>
      <div role="group" aria-label="Fontes mostradas" className="flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <Chip key={s.id} selected={!hidden.has(s.id)} onClick={() => toggleSource(s.id)} icon={<span aria-hidden className={cn("size-2 rounded-full", s.dot)} />}>{s.label}</Chip>
        ))}
      </div>

      <Card className="p-2 sm:p-3">
        <div ref={gridRef} role="grid" aria-label={`Calendário de ${formatMonth(month)}`} onKeyDown={onKey}>
          <div role="row" className="grid grid-cols-7">
            {WEEK.map((w) => <div key={w} role="columnheader" className="py-1 text-center text-label text-muted">{w}</div>)}
          </div>
          {Array.from({ length: days.length / 7 }, (_, r) => (
            <div key={r} role="row" className="grid grid-cols-7">
              {days.slice(r * 7, r * 7 + 7).map((d) => {
                const list = byDay.get(d) ?? [];
                const outside = view === "month" && d.slice(0, 7) !== month;
                const isSel = d === selected;
                return (
                  <div key={d} role="gridcell" aria-selected={isSel}>
                    <button type="button" data-day={d} tabIndex={isSel ? 0 : -1} onClick={() => setSelected(d)}
                      aria-label={`${longDay(d)}${d === today ? ", hoje" : ""}: ${list.length ? `${list.length} ${list.length === 1 ? "item" : "itens"}` : "nada marcado"}`}
                      className={cn("flex w-full flex-col items-center gap-1 rounded-md py-1.5", view === "week" ? "min-h-40 items-stretch px-1" : "min-h-14",
                        isSel ? "bg-surface-3" : "hover:bg-surface-2")}>
                      <span className={cn("mx-auto flex size-7 items-center justify-center rounded-full font-mono text-sm",
                        d === today ? "bg-accent font-semibold text-on-accent" : outside ? "text-muted" : "text-text")}>{Number(d.slice(8))}</span>
                      {view === "month" ? (
                        <span aria-hidden className={cn("flex items-center gap-0.5", outside && "opacity-40")}>
                          {list.slice(0, 3).map((i) => <span key={i.id} className={cn("size-1.5 rounded-full", DOT[i.source])} />)}
                          {list.length > 3 && <span className="text-[10px] leading-none text-muted">+{list.length - 3}</span>}
                        </span>
                      ) : (
                        <span aria-hidden className="flex flex-col gap-1 text-left">
                          {list.slice(0, 5).map((i) => (
                            <span key={i.id} className="flex items-start gap-1 text-[11px] leading-tight text-body">
                              <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", DOT[i.source])} /><span className="line-clamp-2">{i.title}</span>
                            </span>
                          ))}
                          {list.length > 5 && <span className="text-[10px] text-muted">+{list.length - 5}</span>}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <section aria-labelledby="dia-escolhido" className="flex flex-col gap-2">
        <h2 id="dia-escolhido" className="text-label text-muted">{capitalizeFirst(longDay(selected))}</h2>
        {selectedItems.length === 0 ? <p className="text-sm text-muted">Nada marcado neste dia.</p> : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {selectedItems.map((i) => (
              <li key={i.id}>
                <Link href={i.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[i.source])} />
                  <span className="w-12 shrink-0 font-mono text-sm text-muted">{i.time ?? "—"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text">{i.title}</span>
                  <span className="text-xs text-muted">{SOURCES.find((s) => s.id === i.source)!.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
