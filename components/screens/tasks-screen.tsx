"use client";
import { CheckSquare, NotebookText, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { RepeatSelect } from "@/components/ui/repeat-select";
import { CheckItem, EmptyState } from "@/components/ui/data";
import { Field } from "@/components/ui/field";
import { LoadError, PageHeader } from "@/components/ui/load-error";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Task } from "@/lib/data/types";
import { describeRepeat } from "@/lib/domain/recurrence";
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
  const [repeat, setRepeat] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setFormError("Escreva o que precisa ser feito."); return; }
    if (repeat && !dueOn) { setFormError("Para repetir, escolha o primeiro prazo."); return; }
    setSaving(true); setFormError(null);
    try {
      const { task } = await api.createTask({ title: title.trim(), dueOn: dueOn || null, priority, recurrenceRule: repeat || null });
      setData((d) => d && { ...d, tasks: [...d.tasks, task] });
      setTitle(""); setDueOn(""); setPriority("medium"); setRepeat("");
    } catch (err) { setFormError((err as Error).message); } finally { setSaving(false); }
  }

  // muda na hora; volta ao estado anterior se o servidor recusar
  async function toggle(t: Task) {
    const status = t.status === "done" ? "todo" : "done";
    const replace = (next: Task) => setData((d) => d && { ...d, tasks: d.tasks.map((x) => (x.id === t.id ? next : x)) });
    replace({ ...t, status, completedAt: status === "done" ? new Date().toISOString() : null });
    try {
      replace((await api.updateTask(t.id, { status })).task);
      // concluir uma recorrente cria a próxima: recarrega para ela aparecer
      if (t.recurrenceRule && status === "done") reload();
    } catch { replace(t); setSaveError(true); }
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
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
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
          <RepeatSelect id="repetir-nova" value={repeat} onChange={setRepeat} baseDay={dueOn || null} />
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
            const repeats = describeRepeat(t.recurrenceRule);
            return (
              <div key={t.id} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <CheckItem title={t.title} done={t.status === "done"} overdue={!!t.dueOn && t.dueOn < today}
                    meta={[due, `prioridade ${PRIORITY[t.priority]}`, repeats && `repete ${repeats}`, t.notes && "com observações"].filter(Boolean).join(" · ")}
                    onToggle={() => toggle(t)} />
                </div>
                {repeats && <Repeat aria-hidden className="size-4 shrink-0 text-muted" />}
                {t.notes && <NotebookText aria-hidden className="size-4 shrink-0 text-muted" />}
                <IconButton size="sm" label={`Editar ${t.title}`} onClick={() => setEditing(t)}><Pencil className="size-4" /></IconButton>
              </div>
            );
          })}
        </Card>
      )}
      <TaskEditor task={editing} onClose={() => setEditing(null)}
        onSaved={(t) => { setData((d) => d && { ...d, tasks: d.tasks.map((x) => (x.id === t.id ? t : x)) }); setEditing(null); }}
        onDeleted={(id) => { setData((d) => d && { ...d, tasks: d.tasks.filter((x) => x.id !== id) }); setEditing(null); }} />
    </div>
  );
}

// Editar uma tarefa: título, observações, prazo, prioridade e repetição; ou apagar
function TaskEditor({ task, onClose, onSaved, onDeleted }: {
  task: Task | null; onClose: () => void; onSaved: (t: Task) => void; onDeleted: (id: string) => void;
}) {
  return (
    <Dialog open={!!task} onClose={onClose} title="Editar tarefa">
      {task && <TaskEditorForm key={task.id} task={task} onSaved={onSaved} onDeleted={onDeleted} />}
    </Dialog>
  );
}

function TaskEditorForm({ task, onSaved, onDeleted }: { task: Task; onSaved: (t: Task) => void; onDeleted: (id: string) => void }) {
  const [form, setForm] = useState({ title: task.title, notes: task.notes ?? "", dueOn: task.dueOn ?? "", priority: task.priority, repeat: task.recurrenceRule ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("A tarefa precisa de um nome."); return; }
    if (form.repeat && !form.dueOn) { setError("Para repetir, escolha o prazo."); return; }
    setBusy("save"); setError(null);
    try {
      const { task: t } = await api.updateTask(task.id, { title: form.title.trim(), notes: form.notes.trim() || null, dueOn: form.dueOn || null,
        priority: form.priority, recurrenceRule: form.repeat || null });
      onSaved(t);
    } catch (err) { setError((err as Error).message); setBusy(null); }
  }
  async function remove() {
    setBusy("delete");
    try { await api.deleteTask(task.id); onDeleted(task.id); } catch (err) { setError((err as Error).message); setBusy(null); }
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Tarefa" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={300} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="obs-tarefa" className="text-sm font-medium text-body">Observações</label>
        <textarea id="obs-tarefa" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={5000}
          placeholder="Detalhes, links, o que levar…" className="resize-y rounded-md border border-border-input bg-bg px-3 py-2 text-sm text-text placeholder:text-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Prazo" type="date" value={form.dueOn} onChange={(e) => setForm({ ...form, dueOn: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prioridade-edit" className="text-sm font-medium text-body">Prioridade</label>
          <select id="prioridade-edit" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}
            className="h-10 rounded-md border border-border-input bg-bg px-3 text-sm text-text">
            <option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option>
          </select>
        </div>
        <RepeatSelect id="repetir-edit" value={form.repeat} onChange={(repeat) => setForm({ ...form, repeat })} baseDay={form.dueOn || null} />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" icon={<Trash2 className="size-4" />} loading={busy === "delete"} onClick={remove}>Apagar</Button>
        <Button type="submit" loading={busy === "save"}>Salvar</Button>
      </div>
    </form>
  );
}
