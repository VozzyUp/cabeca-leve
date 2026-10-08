"use client";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { archiveCategory, createCategory, renameCategory } from "@/app/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import type { Category } from "@/lib/data/types";

type Usage = Record<string, number>;

// Categorias e subcategorias: criar, renomear, arquivar. Arquivar não apaga os lançamentos antigos.
export function CategoriesManager({ categories, usage }: { categories: Category[]; usage: Usage }) {
  const [kind, setKind] = useState<Category["kind"]>("expense");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [pending, start] = useTransition();
  const tops = categories.filter((c) => c.kind === kind && !c.parentId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const children = (id: string) => categories.filter((c) => c.parentId === id).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Dê um nome à categoria."); return; }
    setError(null);
    start(async () => {
      const r = await createCategory({ name: name.trim(), kind, parentId: parentId || null }).catch(() => ({ ok: false as const, error: "Não deu para salvar. Tente de novo." }));
      if (!r.ok) setError(r.error); else { setName(""); setParentId(""); }
    });
  }

  const row = (c: Category, sub = false) => (
    <li key={c.id} className={sub ? "pl-6" : ""}>
      <div className="flex items-center gap-2 px-3 py-2">
        {sub && <ChevronRight aria-hidden className="size-3.5 text-muted" />}
        <span className="min-w-0 flex-1 truncate text-sm text-text">{c.name}</span>
        <span className="text-xs text-muted">{usage[c.id] ? `${usage[c.id]} lançamento${usage[c.id] === 1 ? "" : "s"}` : "sem uso"}</span>
        <IconButton size="sm" label={`Editar ${c.name}`} onClick={() => setEditing(c)}><Pencil className="size-4" /></IconButton>
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <Segmented label="Tipo" value={kind} onChange={(k) => { setKind(k); setParentId(""); }}
        options={[{ value: "expense", label: "Gastos" }, { value: "income", label: "Entradas" }]} />
      <Card>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Pets" error={error ?? undefined} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cat-pai" className="text-sm font-medium text-body">Dentro de</label>
            <select id="cat-pai" value={parentId} onChange={(e) => setParentId(e.target.value)}
              className="h-10 rounded-md border border-border-input bg-bg px-3 text-sm text-text">
              <option value="">(categoria principal)</option>
              {tops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Button type="submit" loading={pending} icon={<Plus className="size-4" />}>Criar</Button>
        </form>
      </Card>
      <ul aria-label={kind === "expense" ? "Categorias de gastos" : "Categorias de entradas"} className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {tops.map((c) => [row(c), ...children(c.id).map((s) => row(s, true))])}
      </ul>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Editar categoria">
        {editing && <CategoryEditor key={editing.id} category={editing} hasChildren={children(editing.id).length > 0} onDone={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}

function CategoryEditor({ category, hasChildren, onDone }: { category: Category; hasChildren: boolean; onDone: () => void }) {
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      if (!name.trim()) { setError("Dê um nome."); return; }
      start(async () => { try { await renameCategory(category.id, name.trim()); onDone(); } catch { setError("Não deu para salvar."); } });
    }}>
      <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} error={error ?? undefined} />
      <p className="text-xs text-muted">
        Arquivar tira a categoria das listas{hasChildren ? " junto com as subcategorias" : ""}. Os lançamentos antigos continuam com ela.
      </p>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" icon={<Trash2 className="size-4" />} disabled={pending}
          onClick={() => start(async () => { try { await archiveCategory(category.id); onDone(); } catch { setError("Não deu para arquivar."); } })}>Arquivar</Button>
        <Button type="submit" loading={pending}>Salvar</Button>
      </div>
    </form>
  );
}
