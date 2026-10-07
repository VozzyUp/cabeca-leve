"use client";
import { CheckSquare, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckItem, EmptyState } from "@/components/ui/data";
import { Field } from "@/components/ui/field";
import { LoadError, PageHeader } from "@/components/ui/load-error";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Task } from "@/lib/data/types";
import { useResource } from "@/lib/hooks";
import { DEFAULT_TZ, formatDayLabel } from "@/lib/time";

type View = "today" | "upcoming" | "late" | "someday" | "done";
const PRIORITY = { high: "alta", medium: "média", low: "baixa" } as const;
const ORDER = { high: 0, medium: 1, low: 2 } as const;

function inView(t: Task, view: View, today: string) {
  if (view === "done") return t.status === "done";
  if (t.status === "done") return false;
  if (view === "today") return t.dueOn === today;
  if (view === "upcoming") return !!t.dueOn && t.dueOn > today;
  if (view === "late") return !!t.dueOn && t.dueOn < today;
  return !t.dueOn;
}

// S09: tarefas por prazo, com criação rápida
export function TasksScreen() {
  const { data, error, reload, setData } = useResource(api.tasks);
  const [view, setView] = useState<View>("today");
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setFormError("Escreva o que precisa ser feito."); return; }
    setSaving(true); setFormError(null);
    try {
      const { task } = await api.createTask({ title: title.trim(), dueOn: dueOn || null, priority });
      setData((d) => d && { ...d, tasks: [...d.tasks, task] });
      setTitle(""); setDueOn(""); setPriority("medium");
    } catch (err) { setFormError((err as Error).message); } finally { setSaving(false); }
  }

  // muda na hora; volta ao estado anterior se o servidor recusar
  async function toggle(t: Task) {
    const status = t.status === "done" ? "todo" : "done";
    const replace = (next: Task) => setData((d) => d && { ...d, tasks: d.tasks.map((x) => (x.id === t.id ? next : x)) });
    replace({ ...t, status, completedAt: status === "done" ? new Date().toISOString() : null });
    try { replace((await api.updateTask(t.id, { status })).task); }
    catch { replace(t); setSaveError(true); }
  }

  const today = data?.today ?? "";
  const count = (v: View) => data?.tasks.filter((t) => inView(t, v, today)).length ?? 0;
  const list = (data?.tasks.filter((t) => inView(t, view, today)) ?? [])
    .sort((a, b) => (a.dueOn ?? "9").localeCompare(b.dueOn ?? "9") || ORDER[a.priority] - ORDER[b.priority]);
  const label = (v: View, text: string) => (count(v) ? `${text} (${count(v)})` : text);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S09" title="Tarefas" />
      <div className="overflow-x-auto pb-1">
        <Segmented label="Mostrar" value={view} onChange={setView} options={[
          { value: "today", label: label("today", "Hoje") }, { value: "late", label: label("late", "Atrasadas") },
          { value: "upcoming", label: label("upcoming", "Próximas") }, { value: "someday", label: "Sem prazo" },
          { value: "done", label: "Feitas" },
        ]} />
      </div>

      <Card>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <Field label="Nova tarefa" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: renovar o seguro do carro" maxLength={300} error={formError ?? undefined} />
          <Field label="Prazo" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prioridade" className="text-sm font-medium text-body">Prioridade</label>
            <select id="prioridade" value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])}
              className="h-10 rounded-md border border-border-input bg-bg px-3 text-sm text-text">
              <option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option>
            </select>
          </div>
          <Button type="submit" loading={saving} icon={<Plus className="size-4" />}>Adicionar</Button>
        </form>
      </Card>

      {(error || saveError) && <LoadError what={error ? "carregar as tarefas" : "salvar a mudança"} onRetry={() => { setSaveError(false); reload(); }} />}
      {!data && !error && <div className="flex flex-col gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>}
      {data && list.length === 0 && (
        <EmptyState icon={<CheckSquare className="size-8" />}
          title={{ today: "Nada para hoje", late: "Nada atrasado", upcoming: "Nada pela frente", someday: "Nenhuma tarefa sem prazo", done: "Nada concluído ainda" }[view]}
          text="Adicione acima ou diga na conversa: “cria uma tarefa de ligar para o banco amanhã”." />
      )}
      {data && list.length > 0 && (
        <Card className="p-2">
          {list.map((t) => {
            const due = t.dueOn ? formatDayLabel(t.dueOn, new Date(), DEFAULT_TZ) : "sem prazo";
            return <CheckItem key={t.id} title={t.title} done={t.status === "done"} overdue={!!t.dueOn && t.dueOn < today}
              meta={`${due} · prioridade ${PRIORITY[t.priority]}`} onToggle={() => toggle(t)} />;
          })}
        </Card>
      )}
    </div>
  );
}
