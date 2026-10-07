"use client";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckItem, EmptyState } from "@/components/ui/data";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import type { Reminder } from "@/lib/data/types";
import { formatDayLabel, formatTime, localDate } from "@/lib/time";

// S11: lembretes por dia; concluir e reabrir
export function RemindersScreen() {
  const { data, error: loadError, reload: load, setData } = useResource(api.reminders);
  const [saveError, setSaveError] = useState(false);
  const [view, setView] = useState<"next" | "done">("next");
  const error = loadError || saveError;

  async function toggle(r: Reminder) {
    const status = r.status === "active" ? "done" : "active";
    try {
      const { reminder } = await api.updateReminder(r.id, { status });
      setData((d) => d && { ...d, reminders: d.reminders.map((x) => (x.id === r.id ? reminder : x)) });
    } catch { setSaveError(true); }
  }

  const now = new Date();
  const list = data?.reminders.filter((r) => (view === "next" ? r.status === "active" : r.status === "done")) ?? [];
  // agrupa por dia local
  const groups = new Map<string, Reminder[]>();
  for (const r of list) {
    const key = r.nextFireAt && data ? localDate(new Date(r.nextFireAt), data.timezone) : "sem-data";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label text-muted">S11</p>
          <h1 className="text-[28px] font-bold leading-[34px]">Lembretes</h1>
        </div>
        <Segmented label="Mostrar" value={view} onChange={setView}
          options={[{ value: "next", label: "Próximos" }, { value: "done", label: "Concluídos" }]} />
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-md border border-danger px-4 py-3 text-sm">
          Não deu para carregar os lembretes.
          <Button size="sm" variant="secondary" onClick={() => { setSaveError(false); load(); }}>Tentar de novo</Button>
        </div>
      )}
      {!data && !error && <div className="flex flex-col gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}

      {data && list.length === 0 && (
        <EmptyState icon={<Bell className="size-8" />}
          title={view === "next" ? "Nenhum lembrete pela frente" : "Nada concluído ainda"}
          text="Peça na conversa, do seu jeito: “me lembra de levar o lixo hoje às 20h”."
          action={<Link href="/conversa" className="text-sm font-medium text-info hover:underline">Abrir a conversa</Link>} />
      )}

      {data && [...groups.entries()].map(([day, items]) => (
        <section key={day} aria-label={day === "sem-data" ? "Sem data" : formatDayLabel(day, now, data.timezone)}>
          <h2 className="mb-2 text-label text-muted">
            {day === "sem-data" ? "Sem data" : formatDayLabel(day, now, data.timezone)}
          </h2>
          <Card className="p-2">
            {items.map((r) => {
              const overdue = r.status === "active" && !!r.nextFireAt && new Date(r.nextFireAt) < now;
              const meta = r.nextFireAt ? formatTime(r.nextFireAt, data.timezone) : "concluído";
              return <CheckItem key={r.id} title={r.title} meta={meta} done={r.status === "done"} overdue={overdue} onToggle={() => toggle(r)} />;
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
