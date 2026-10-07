"use client";
import { Bell, CalendarDays, CheckSquare, Sprout } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState, Progress } from "@/components/ui/data";
import { LoadError, PageHeader } from "@/components/ui/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { DayItem } from "@/lib/domain/day";
import { useResource } from "@/lib/hooks";
import { capitalizeFirst } from "@/lib/time";

const ICON = { reminder: Bell, task: CheckSquare, habit: Sprout };
const KIND = { reminder: "Lembrete", task: "Tarefa", habit: "Hábito" };

// S05: o dia de hoje numa linha do tempo
export function DayScreen() {
  const { data, error, reload, setData } = useResource(api.day);
  const [saveError, setSaveError] = useState(false);

  // muda na hora; volta ao estado anterior se o servidor recusar
  async function toggle(item: DayItem) {
    const flip = (done: boolean) => setData((d) => d && {
      ...d, items: d.items.map((x) => (x.kind === item.kind && x.id === item.id ? { ...x, done } : x)),
    });
    flip(!item.done);
    try {
      if (item.kind === "task") await api.updateTask(item.id, { status: item.done ? "todo" : "done" });
      else if (item.kind === "habit" && data) await api.setHabitDone(item.id, data.today, !item.done);
    } catch { flip(item.done); setSaveError(true); }
  }

  const dateLabel = data && capitalizeFirst(new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
    .format(new Date(`${data.today}T12:00:00Z`)));
  const done = data?.items.filter((i) => i.done).length ?? 0;
  const total = data?.items.length ?? 0;
  const timed = data?.items.filter((i) => i.time) ?? [];
  const untimed = data?.items.filter((i) => !i.time) ?? [];

  const row = (i: DayItem) => {
    const Icon = ICON[i.kind];
    const checkable = i.kind !== "reminder";
    return (
      <li key={`${i.kind}-${i.id}`} className="flex items-center gap-3 px-2 py-2.5">
        <span className={cn("w-12 shrink-0 font-mono text-sm", i.overdue && !i.done ? "text-warning" : "text-muted")}>{i.time ?? "—"}</span>
        {checkable ? (
          <input type="checkbox" checked={i.done} onChange={() => toggle(i)} aria-label={`${KIND[i.kind]}: ${i.title}`}
            className="size-4 shrink-0 accent-[var(--c-accent)]" />
        ) : <Icon aria-hidden className="size-4 shrink-0 text-muted" />}
        <Link href={i.href} className="min-w-0 flex-1 rounded-sm hover:underline">
          <span className={cn("block truncate text-sm", i.done ? "text-muted line-through" : "text-text")}>{i.title}</span>
          <span className={cn("text-xs", i.overdue && !i.done ? "text-warning" : "text-muted")}>
            {KIND[i.kind]}{i.overdue && !i.done ? (i.time ? " · passou do horário" : " · atrasada") : ""}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S05" title="Meu dia">
        {dateLabel && <p className="text-sm text-body">{dateLabel}</p>}
      </PageHeader>
      {(error || saveError) && <LoadError what={error ? "carregar o seu dia" : "salvar a mudança"} onRetry={() => { setSaveError(false); reload(); }} />}
      {!data && !error && <div className="flex flex-col gap-2"><Skeleton className="h-10" /><Skeleton className="h-40" /></div>}
      {data && total === 0 && (
        <EmptyState icon={<CalendarDays className="size-8" />} title="Dia livre"
          text="Nada com hora marcada, nenhuma tarefa para hoje e nenhum hábito planejado." />
      )}
      {data && total > 0 && (
        <>
          <Progress label="Feito hoje" value={done} max={total} display={`${done} de ${total}`} />
          {timed.length > 0 && (
            <section aria-label="Com horário">
              <h2 className="mb-2 text-label text-muted">Com horário</h2>
              <Card className="p-2"><ul className="divide-y divide-border">{timed.map(row)}</ul></Card>
            </section>
          )}
          {untimed.length > 0 && (
            <section aria-label="Sem horário">
              <h2 className="mb-2 text-label text-muted">Sem horário</h2>
              <Card className="p-2"><ul className="divide-y divide-border">{untimed.map(row)}</ul></Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
