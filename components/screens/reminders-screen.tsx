"use client";
import { Bell, Plus, Repeat, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckItem, EmptyState } from "@/components/ui/data";
import { Field } from "@/components/ui/field";
import { RepeatSelect } from "@/components/ui/repeat-select";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import type { Reminder } from "@/lib/data/types";
import { describeRepeat } from "@/lib/domain/recurrence";
import { formatDayLabel, formatTime, localDate, zonedToUtc } from "@/lib/time";

// S11: lembretes por dia; concluir e reabrir
export function RemindersScreen() {
  const { data, error: loadError, reload: load, setData } = useResource(api.reminders);
  const [saveError, setSaveError] = useState(false);
  const [view, setView] = useState<"next" | "done">("next");
  const error = loadError || saveError;
  const [form, setForm] = useState({ title: "", day: "", time: "", repeat: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setFormError("Escreva do que lembrar."); return; }
    if (!data) return;  // o fuso vem com a lista; o botão fica desligado até ela chegar
    if (!form.day || !form.time) { setFormError("Escolha o dia e a hora."); return; }
    const [y, m, d] = form.day.split("-").map(Number);
    const [h, min] = form.time.split(":").map(Number);
    const at = zonedToUtc(y, m, d, h, min, data.timezone);
    if (at.getTime() < Date.now()) { setFormError("Esse horário já passou."); return; }
    setSaving(true); setFormError(null);
    try {
      const { reminder } = await api.createReminder({ title: form.title.trim(), nextFireAt: at.toISOString(), recurrenceRule: form.repeat || null });
      setData((dd) => dd && { ...dd, reminders: [...dd.reminders, reminder].sort((a, b) => (a.nextFireAt ?? "9").localeCompare(b.nextFireAt ?? "9")) });
      setForm({ title: "", day: "", time: "", repeat: "" });
    } catch (err) { setFormError((err as Error).message); } finally { setSaving(false); }
  }

  async function remove(r: Reminder) {
    setData((d) => d && { ...d, reminders: d.reminders.filter((x) => x.id !== r.id) });
    try { await api.deleteReminder(r.id); } catch { setSaveError(true); load(); }
  }

  // muda na hora; volta ao estado anterior se o servidor recusar
  async function toggle(r: Reminder) {
    const status = r.status === "active" ? "done" : "active";
    const replace = (next: Reminder) => setData((d) => d && { ...d, reminders: d.reminders.map((x) => (x.id === r.id ? next : x)) });
    replace({ ...r, status });
    try { replace((await api.updateReminder(r.id, { status })).reminder); }
    catch { replace(r); setSaveError(true); }
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

      <Card>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
          <Field label="Novo lembrete" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex.: tomar o remédio" maxLength={300} error={formError ?? undefined} />
          <Field label="Dia" type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
          <Field label="Hora" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          <RepeatSelect id="repetir-lembrete" value={form.repeat} onChange={(repeat) => setForm({ ...form, repeat })} baseDay={form.day || null} />
          <Button type="submit" loading={saving} disabled={!data} icon={<Plus className="size-4" />}>Criar</Button>
        </form>
      </Card>

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
              const repeats = describeRepeat(r.recurrenceRule);
              const meta = [r.nextFireAt ? formatTime(r.nextFireAt, data.timezone) : "concluído", repeats && `repete ${repeats}`].filter(Boolean).join(" · ");
              return (
                <div key={r.id} className="flex items-center gap-1">
                  <div className="min-w-0 flex-1"><CheckItem title={r.title} meta={meta} done={r.status === "done"} overdue={overdue} onToggle={() => toggle(r)} /></div>
                  {repeats && <Repeat aria-hidden className="size-4 shrink-0 text-muted" />}
                  <IconButton size="sm" label={`Apagar ${r.title}`} onClick={() => remove(r)}><Trash2 className="size-4" /></IconButton>
                </div>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
