"use client";
import { BookOpen, Pin, PinOff, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { createNote, updateNote } from "@/app/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/data";
import { Segmented } from "@/components/ui/segmented";
import type { Note } from "@/lib/data/types";

const fmt = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short", weekday: "short" }).format(new Date(iso));

// S26: notas por caderno, busca e diário
export function NotesBoard({ notes }: { notes: Note[] }) {
  const [mode, setMode] = useState<"note" | "journal">("note");
  const [notebook, setNotebook] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const notebooks = useMemo(() => [...new Set(notes.filter((n) => n.kind === "note").map((n) => n.notebook))].sort(), [notes]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return notes.filter((n) => n.kind === mode && (mode === "journal" || !notebook || n.notebook === notebook)
      && (!q || `${n.title} ${n.body}`.toLocaleLowerCase("pt-BR").includes(q)));
  }, [notes, mode, notebook, query]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() && !draft.body.trim()) { setError("Escreva um título ou um texto."); return; }
    setError(null);
    start(async () => {
      try {
        await createNote({ ...draft, kind: mode, notebook: mode === "journal" ? "Diário" : notebook ?? "Geral" });
        setDraft({ title: "", body: "" });
      } catch { setError("Não deu para salvar a nota. Tente de novo."); }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Tipo" value={mode} onChange={setMode} options={[{ value: "note", label: "Notas" }, { value: "journal", label: "Diário" }]} />
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="busca-notas" className="sr-only">Buscar nas notas</label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input id="busca-notas" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar"
            className="h-10 w-full rounded-md border border-border-input bg-bg pl-9 pr-3 text-sm text-text placeholder:text-muted" />
        </div>
      </div>
      {mode === "note" && notebooks.length > 0 && (
        <div role="group" aria-label="Cadernos" className="flex flex-wrap gap-2">
          <Chip selected={!notebook} onClick={() => setNotebook(null)}>Todos</Chip>
          {notebooks.map((nb) => <Chip key={nb} selected={notebook === nb} onClick={() => setNotebook(nb)}>{nb}</Chip>)}
        </div>
      )}

      <form onSubmit={save}>
        {/* o anel de foco fica no cartão inteiro, como no campo de mensagem */}
        <Card className="flex flex-col gap-2 ring-focus has-[input:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-2">
          <label htmlFor="nota-titulo" className="sr-only">Título</label>
          <input id="nota-titulo" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder={mode === "journal" ? "Como foi o dia?" : `Nova nota${notebook ? ` em ${notebook}` : ""}`}
            className="bg-transparent text-sm font-medium text-text placeholder:text-muted focus-visible:outline-none" />
          <label htmlFor="nota-texto" className="sr-only">Texto</label>
          <textarea id="nota-texto" rows={2} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="Escreva aqui…" className="resize-y bg-transparent text-sm text-body placeholder:text-muted focus-visible:outline-none" />
          <div className="flex items-center justify-between gap-3">
            {error ? <p role="alert" className="text-xs text-danger">{error}</p> : <span className="text-xs text-muted">Ou mande pela conversa: &ldquo;anota que…&rdquo;</span>}
            <Button type="submit" size="sm" loading={pending}>Salvar</Button>
          </div>
        </Card>
      </form>

      {visible.length === 0 ? (
        <EmptyState icon={<BookOpen className="size-8" />} title={query ? `Nada encontrado para “${query}”` : mode === "journal" ? "Diário vazio" : "Nenhuma nota aqui"}
          text={mode === "journal" ? "Escreva umas linhas sobre o dia. Só você vê." : "Guarde ideias, listas e o que não pode esquecer."} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((n) => (
            <li key={n.id}>
              <Card className="flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-text">{n.title || "Sem título"}</h2>
                  {n.kind === "note" && (
                    <IconButton size="sm" label={n.pinned ? `Desafixar ${n.title}` : `Fixar ${n.title}`} className="-mr-1 -mt-1 shrink-0"
                      onClick={() => start(async () => { await updateNote(n.id, { pinned: !n.pinned }); })}>
                      {n.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                    </IconButton>
                  )}
                </div>
                <p className="line-clamp-5 whitespace-pre-line text-sm text-body">{n.body}</p>
                <p className="mt-auto text-xs text-muted">{n.kind === "journal" ? fmt(n.createdAt) : `${n.pinned ? "Fixada · " : ""}${n.notebook} · ${fmt(n.updatedAt)}`}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
