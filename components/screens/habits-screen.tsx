"use client";
import { Check, Flame, Plus, Sprout } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { describeWeekdays } from "@/lib/assistant/weekdays";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/data";
import { Field } from "@/components/ui/field";
import { LoadError, PageHeader } from "@/components/ui/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";

const DAY_LETTER = ["D", "S", "T", "Q", "Q", "S", "S"];
const DAY_NAME = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const weekdayOf = (day: string) => { const [y, m, d] = day.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

// S12: hábitos do dia, constância da semana, sequência e recorde
export function HabitsScreen() {
  const { data, error, reload } = useResource(api.habits);
  const [busy, setBusy] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function toggle(id: string, day: string, done: boolean) {
    setBusy(id);
    try { await api.setHabitDone(id, day, done); reload(); } catch { setSaveError(true); } finally { setBusy(null); }
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setFormError("Dê um nome ao hábito."); return; }
    setFormError(null);
    try { await api.createHabit({ name: name.trim(), weekdays: [0, 1, 2, 3, 4, 5, 6], time: time || null }); setName(""); setTime(""); reload(); }
    catch (err) { setFormError((err as Error).message); }
  }

  const today = data?.today ?? "";
  const planned = data?.habits.filter((h) => h.stats.scheduledToday) ?? [];
  const doneCount = planned.filter((h) => h.stats.doneToday).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S12" title="Hábitos">
        {data && planned.length > 0 && <p className="text-sm text-body"><span className="font-mono text-text">{doneCount} de {planned.length}</span> feitos hoje</p>}
      </PageHeader>

      {(error || saveError) && <LoadError what={error ? "carregar os hábitos" : "salvar o registro"} onRetry={() => { setSaveError(false); reload(); }} />}
      {!data && !error && <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>}
      {data && data.habits.length === 0 && (
        <EmptyState icon={<Sprout className="size-8" />} title="Nenhum hábito ainda"
          text="Crie abaixo ou diga na conversa: “quero ler 20 minutos todo dia às 21h”." />
      )}

      {data && data.habits.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.habits.map((h) => (
            <li key={h.id}>
              <Card className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold"><Link href={`/habitos/${h.id}`} className="hover:underline">{h.name}</Link></h2>
                    <p className="text-xs text-muted">{describeWeekdays(h.weekdays)}{h.time ? ` · ${h.time}` : ""}</p>
                  </div>
                  {h.stats.scheduledToday ? (
                    <Button size="sm" variant={h.stats.doneToday ? "secondary" : "primary"} loading={busy === h.id}
                      icon={h.stats.doneToday ? <Check className="size-4" /> : undefined}
                      aria-pressed={h.stats.doneToday}
                      onClick={() => toggle(h.id, today, !h.stats.doneToday)}>
                      {h.stats.doneToday ? "Feito" : "Marcar hoje"}
                    </Button>
                  ) : <span className="text-xs text-muted">folga hoje</span>}
                </div>
                <ol aria-label="Últimos 7 dias" className="flex justify-between gap-1">
                  {h.stats.last7.map((d) => (
                    <li key={d.day} className="flex flex-col items-center gap-1">
                      <span aria-hidden className="text-[11px] text-muted">{DAY_LETTER[weekdayOf(d.day)]}</span>
                      <span className={cn("flex size-7 items-center justify-center rounded-full border text-[11px]",
                        d.done ? "border-success bg-success text-bg" : d.scheduled ? "border-border-input" : "border-transparent bg-surface-2")}>
                        {d.done && <Check aria-hidden className="size-3.5" />}
                      </span>
                      <span className="sr-only">{DAY_NAME[weekdayOf(d.day)]}: {d.done ? "feito" : d.scheduled ? "não feito" : "folga"}</span>
                    </li>
                  ))}
                </ol>
                <div className="flex gap-6 text-sm">
                  <p className="flex items-center gap-1.5 text-body"><Flame aria-hidden className="size-4 text-warning" />
                    Sequência <span className="font-mono text-text">{h.stats.streak}</span></p>
                  <p className="text-body">Recorde <span className="font-mono text-text">{h.stats.best}</span></p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Novo hábito (todo dia)" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: beber 2 litros de água" error={formError ?? undefined} />
          <Field label="Horário" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <Button type="submit" icon={<Plus className="size-4" />}>Criar</Button>
        </form>
      </Card>
    </div>
  );
}
