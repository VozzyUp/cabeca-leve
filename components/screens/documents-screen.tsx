"use client";
import { CalendarClock, FileImage, FileText, FolderOpen, Pencil, Plus, Search, Upload } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { loadDocuments, setDocumentsStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/data";
import { LoadError, PageHeader } from "@/components/ui/load-error";
import { useResource } from "@/lib/hooks";
import type { Doc, DocStatus } from "@/lib/data/types";
import { deadlineOf, deadlineText, filterDocs, NO_STATUS_LABEL, sortDocs, STATUS_LABEL, STATUS_ORDER, totalsByStatus } from "@/lib/domain/documents";
import { formatBytes } from "@/lib/limits";
import { formatMoney, formatShortDate, localDate } from "@/lib/time";
import { DocumentDialog, FolderDialog } from "./document-dialogs";

type StatusFilter = "all" | DocStatus | "stored";
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

// S41: notas fiscais, recibos e pedidos em pastas, com status de reembolso e prazo
export function DocumentsScreen() {
  const { data, error, reload } = useResource(loadDocuments);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [chosenFolder, setFolder] = useState<string>("all");  // "all", "none" ou o id da pasta
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Doc | null>(null);
  const [folderDialog, setFolderDialog] = useState<"new" | NonNullable<typeof data>["folders"][number] | null>(null);
  const [storeOnly, setStoreOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  // pasta apagada (aqui ou em outro aparelho): volta para "todas" em vez de mostrar uma lista vazia
  const folder = chosenFolder === "all" || chosenFolder === "none" || data?.folders.some((f) => f.id === chosenFolder) ? chosenFolder : "all";
  const today = useMemo(() => (data ? localDate(new Date(), data.timezone) : ""), [data]);
  const docs = useMemo(() => data?.documents ?? [], [data]);
  const totals = useMemo(() => totalsByStatus(docs), [docs]);
  const urgent = useMemo(() => docs.filter((d) => { const dl = deadlineOf(d, today); return dl && dl.state !== "ok"; }).length, [docs, today]);
  const visible = useMemo(() => sortDocs(filterDocs(docs, {
    status: status === "all" ? null : status, folderId: folder === "all" ? null : folder, query,
  })), [docs, status, folder, query]);
  const folderCount = (id: string) => docs.filter((d) => d.folderId === id).length;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    let added: Doc | null = null, failed = 0, lastError = "";
    for (const [i, file] of list.entries()) {
      setBusy(`Guardando ${i + 1} de ${list.length}: ${file.name}`);
      const body = new FormData();
      body.set("file", file);
      if (folder !== "all" && folder !== "none") body.set("folderId", folder);
      if (storeOnly) body.set("storeOnly", "1");
      try {
        const res = await fetch("/api/documents", { method: "POST", body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { failed++; lastError = json.error ?? "Não deu para guardar."; }
        else added = json.document;
      } catch { failed++; lastError = "Sem conexão. Tente de novo."; }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    reload();
    if (failed) setNotice({ tone: "error", text: list.length === 1 ? lastError : `${failed} de ${list.length} arquivos não foram guardados. ${lastError}` });
    else setNotice({ tone: "ok", text: list.length === 1 ? "Guardei. Confira os dados abaixo." : `Guardei ${list.length} documentos.` });
    if (added && list.length === 1) setEditing(added);  // um arquivo só: abre para conferir o que a IA leu
  }

  function bulk(to: DocStatus | null) {
    const ids = [...selected];
    start(async () => {
      try { await setDocumentsStatus(ids, to); setSelected(new Set()); reload(); setNotice({ tone: "ok", text: `${ids.length} ${ids.length === 1 ? "documento atualizado" : "documentos atualizados"}.` }); }
      catch { setNotice({ tone: "error", text: "Não deu para atualizar. Tente de novo." }); }
    });
  }

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const percent = data ? Math.min(100, Math.round((data.usedBytes / data.limitBytes) * 100)) : 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader id="S41" title="Documentos">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setFolderDialog("new")}>Nova pasta</Button>
          <Button icon={<Upload className="size-4" />} loading={!!busy} onClick={() => input.current?.click()}>Enviar documento</Button>
          <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" aria-label="Escolher fotos ou PDFs" tabIndex={-1} onChange={(e) => upload(e.target.files)} />
        </div>
      </PageHeader>

      {error && <LoadError what="abrir os documentos" onRetry={reload} />}
      {busy && <p role="status" className="text-sm text-body">{busy}…</p>}
      {notice && <p role={notice.tone === "error" ? "alert" : "status"} className={cn("text-sm", notice.tone === "error" ? "text-danger" : "text-success")}>{notice.text}</p>}
      {!data && !error && <p className="text-sm text-muted">Carregando…</p>}

      {data && docs.length === 0 && data.folders.length === 0 && (
        <EmptyState icon={<FileText className="size-8" />} title="Nenhum documento ainda"
          text="Guarde aqui notas fiscais, recibos e pedidos médicos. O assistente lê os dados e você acompanha o que falta pedir de reembolso."
          action={<Button icon={<Upload className="size-4" />} onClick={() => input.current?.click()}>Enviar o primeiro</Button>} />
      )}

      {data && (docs.length > 0 || data.folders.length > 0) && (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumo do reembolso">
            {STATUS_ORDER.map((s) => (
              <li key={s}>
                <button type="button" aria-pressed={status === s} onClick={() => setStatus(status === s ? "all" : s)}
                  className={cn("flex w-full flex-col items-start gap-1 rounded-lg border bg-surface p-4 text-left transition-colors hover:bg-surface-2", status === s ? "border-accent" : "border-border")}>
                  <span className="text-label text-muted">{STATUS_LABEL[s]}</span>
                  <span className="font-mono text-2xl font-semibold text-text">{formatMoney(totals[s].cents)}</span>
                  <span className="text-xs text-muted">{totals[s].count} {totals[s].count === 1 ? "documento" : "documentos"}</span>
                </button>
              </li>
            ))}
          </ul>

          {urgent > 0 && (
            <p role="status" className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm text-text">
              <CalendarClock aria-hidden className="size-4 shrink-0 text-warning" />
              {urgent === 1 ? "1 documento está perto do prazo ou vencido." : `${urgent} documentos estão perto do prazo ou vencidos.`}
              <button type="button" className="font-medium underline" onClick={() => { setStatus("pending"); setFolder("all"); }}>Ver pendentes</button>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Pastas">
            <Chip selected={folder === "all"} onClick={() => setFolder("all")}>Todas ({docs.length})</Chip>
            {data.folders.map((f) => (
              <Chip key={f.id} selected={folder === f.id} icon={<FolderOpen aria-hidden className="size-3.5" />} onClick={() => setFolder(f.id)}>
                {f.name} ({folderCount(f.id)})
              </Chip>
            ))}
            {docs.some((d) => !d.folderId) && <Chip selected={folder === "none"} onClick={() => setFolder("none")}>Sem pasta ({docs.filter((d) => !d.folderId).length})</Chip>}
            {folder !== "all" && folder !== "none" && (
              <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setFolderDialog(data.folders.find((f) => f.id === folder) ?? null)}>Editar pasta</Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <label htmlFor="busca-documentos" className="sr-only">Buscar nos documentos</label>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input id="busca-documentos" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, médico, pessoa…"
                className="h-10 w-full rounded-md border border-border-input bg-bg pl-9 pr-3 text-sm text-text placeholder:text-muted" />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
              {([["all", "Todos"], ["pending", "Pendentes"], ["submitted", "Enviados"], ["reimbursed", "Reembolsados"], ["stored", NO_STATUS_LABEL]] as const).map(([v, label]) => (
                <Chip key={v} selected={status === v} onClick={() => setStatus(v)}>{label}</Chip>
              ))}
            </div>
          </div>

          <label className="flex w-fit items-center gap-2 text-sm text-body">
            <input type="checkbox" checked={storeOnly} onChange={(e) => setStoreOnly(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Só guardar o próximo envio (não é para reembolso)
          </label>

          {selected.size > 0 && (
            <div role="region" aria-label="Ações para os selecionados" className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-surface-2 p-3 shadow-pop">
              <span className="text-sm font-medium text-text">{selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}</span>
              <Button size="sm" variant="secondary" loading={pending} onClick={() => bulk("submitted")}>Marcar como enviado</Button>
              <Button size="sm" variant="secondary" loading={pending} onClick={() => bulk("reimbursed")}>Marcar como reembolsado</Button>
              <Button size="sm" variant="ghost" loading={pending} onClick={() => bulk("pending")}>Voltar para pendente</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyState icon={<FileText className="size-8" />} title="Nada por aqui" text={query || status !== "all" || folder !== "all" ? "Nenhum documento combina com esses filtros." : "Envie o primeiro documento desta pasta."} />
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Documentos">
              {visible.map((d) => (
                <DocRow key={d.id} doc={d} today={today} folderName={data.folders.find((f) => f.id === d.folderId)?.name ?? null}
                  checked={selected.has(d.id)} onToggle={() => toggle(d.id)} onOpen={() => setEditing(d)} />
              ))}
            </ul>
          )}

          <Card className="flex flex-col gap-2">
            <p className="text-sm text-body">Espaço usado: <strong className="text-text">{formatBytes(data.usedBytes)}</strong> de {formatBytes(data.limitBytes)}</p>
            <div role="progressbar" aria-label="Espaço usado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className={cn("h-full rounded-full", percent >= 90 ? "bg-danger" : "bg-accent")} style={{ width: `${percent}%` }} />
            </div>
            {percent >= 90 && <p className="text-xs text-warning">O espaço está acabando. Apague documentos que você não precisa mais{percent >= 100 ? " para guardar novos" : ""}.</p>}
          </Card>
        </>
      )}

      <DocumentDialog doc={editing} folders={data?.folders ?? []} onClose={() => setEditing(null)} onChanged={reload} />
      <FolderDialog folder={folderDialog} open={!!folderDialog} onClose={() => setFolderDialog(null)}
        onChanged={(created) => { reload(); if (created) setFolder(created.id); }} />
    </div>
  );
}

function DocRow({ doc, today, folderName, checked, onToggle, onOpen }: { doc: Doc; today: string; folderName: string | null; checked: boolean; onToggle: () => void; onOpen: () => void }) {
  const dl = deadlineOf(doc, today);
  const Icon = doc.mimeType === "application/pdf" ? FileText : FileImage;
  const meta = [doc.issuer, doc.beneficiary ? `para ${doc.beneficiary}` : null, doc.docDate ? formatShortDate(doc.docDate) : null, folderName].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Selecionar ${doc.title}`} className="size-5 shrink-0 accent-[var(--accent)]" />
      <button type="button" onClick={onOpen} aria-label={`Abrir ${doc.title}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Icon aria-hidden className="size-6 shrink-0 text-muted" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-text">{doc.title}</span>
          {meta && <span className="truncate text-xs text-muted">{meta}</span>}
          <span className="flex flex-wrap items-center gap-x-2 text-xs">
            <span className={cn("font-medium", doc.status === "reimbursed" ? "text-success" : doc.status === null ? "text-muted" : "text-body")}>{doc.status ? STATUS_LABEL[doc.status] : NO_STATUS_LABEL}</span>
            {dl && <span className={cn(dl.state === "overdue" ? "text-danger" : dl.state === "soon" ? "text-warning" : "text-muted")}>{deadlineText(dl)}</span>}
          </span>
        </span>
        {doc.amountCents !== null && <span className="shrink-0 font-mono text-sm font-semibold text-text">{formatMoney(doc.amountCents)}</span>}
      </button>
    </li>
  );
}
