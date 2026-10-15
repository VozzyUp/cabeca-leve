"use client";
import { Download, ExternalLink, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { createDocFolder, deleteDocFolder, deleteDocument, updateDocFolder, updateDocument } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { DOC_CATEGORIES } from "@/lib/documents-categories";
import { NO_STATUS_LABEL, parseReais, reaisText, STATUS_LABEL } from "@/lib/domain/documents";
import type { Doc, DocFolder, DocStatus } from "@/lib/data/types";
import { formatBytes } from "@/lib/limits";

const select = "h-10 rounded-md border border-border-input bg-bg px-3 text-sm text-text";
const message = (e: unknown, fallback: string) => (e instanceof Error && e.message && !/server components render|digest/i.test(e.message) ? e.message : fallback);

// Edição de um documento: dados, pasta, status e prazo. O arquivo original abre e baixa daqui.
export function DocumentDialog({ doc, folders, onClose, onChanged }: { doc: Doc | null; folders: DocFolder[]; onClose: () => void; onChanged: () => void }) {
  return (
    <Dialog open={!!doc} onClose={onClose} title="Documento">
      {doc && <DocumentForm key={doc.id} doc={doc} folders={folders} onClose={onClose} onChanged={onChanged} />}
    </Dialog>
  );
}

function DocumentForm({ doc, folders, onClose, onChanged }: { doc: Doc; folders: DocFolder[]; onClose: () => void; onChanged: () => void }) {
  const [f, setF] = useState({
    title: doc.title, issuer: doc.issuer ?? "", beneficiary: doc.beneficiary ?? "", category: doc.category ?? "", docDate: doc.docDate ?? "",
    amount: reaisText(doc.amountCents), folderId: doc.folderId ?? "", status: (doc.status ?? "stored") as DocStatus | "stored", dueOn: doc.dueOn ?? "", notes: doc.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((s) => ({ ...s, [key]: value }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return setError("O documento precisa de um nome.");
    const amountCents = f.amount.trim() ? parseReais(f.amount) : null;
    if (f.amount.trim() && amountCents === null) return setError("Não entendi o valor. Escreva como 187,50.");
    setError(null);
    start(async () => {
      try {
        await updateDocument(doc.id, {
          title: f.title, issuer: f.issuer, beneficiary: f.beneficiary, category: f.category, docDate: f.docDate || null, amountCents,
          folderId: f.folderId || null, status: f.status === "stored" ? null : f.status, notes: f.notes,
          // prazo mexido à mão vale como está; sem mexer, a pasta e a data recalculam sozinhas
          ...(f.status !== "pending" ? { dueOn: null } : f.dueOn !== (doc.dueOn ?? "") ? { dueOn: f.dueOn || null } : {}),
        });
        onChanged();
        onClose();
      } catch (err) { setError(message(err, "Não deu para salvar. Tente de novo.")); }
    });
  }

  function remove() {
    start(async () => {
      try { await deleteDocument(doc.id); onChanged(); onClose(); }
      catch (err) { setError(message(err, "Não deu para apagar. Tente de novo.")); }
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-text underline">
          <ExternalLink aria-hidden className="size-4" />Abrir o original
        </a>
        <a href={`/api/documents/${doc.id}/file?download=1`} className="inline-flex items-center gap-1.5 font-medium text-text underline">
          <Download aria-hidden className="size-4" />Baixar
        </a>
        <span className="text-muted">{doc.fileName} · {formatBytes(doc.sizeBytes)}</span>
      </div>
      <Field label="Nome" value={f.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Emitido por" hint="Médico, clínica, restaurante…" value={f.issuer} maxLength={120} onChange={(e) => set("issuer", e.target.value)} />
        <Field label="Para quem" hint="Você, filho, esposa…" value={f.beneficiary} maxLength={80} onChange={(e) => set("beneficiary", e.target.value)} />
        <Field label="Data do documento" type="date" value={f.docDate} onChange={(e) => set("docDate", e.target.value)} />
        <Field label="Valor (R$)" inputMode="decimal" placeholder="0,00" value={f.amount} onChange={(e) => set("amount", e.target.value)} />
        <Field label="Categoria" list="categorias-documento" value={f.category} maxLength={60} onChange={(e) => set("category", e.target.value)} />
        <datalist id="categorias-documento">{DOC_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doc-pasta" className="text-sm font-medium text-body">Pasta</label>
          <select id="doc-pasta" className={select} value={f.folderId} onChange={(e) => set("folderId", e.target.value)}>
            <option value="">Sem pasta</option>
            {folders.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="doc-status" className="text-sm font-medium text-body">Reembolso</label>
          <select id="doc-status" className={select} value={f.status} onChange={(e) => set("status", e.target.value as typeof f.status)}>
            <option value="pending">{STATUS_LABEL.pending}: ainda vou pedir</option>
            <option value="submitted">{STATUS_LABEL.submitted}: já pedi</option>
            <option value="reimbursed">{STATUS_LABEL.reimbursed}: já recebi</option>
            <option value="stored">{NO_STATUS_LABEL}: não é para reembolso</option>
          </select>
        </div>
        {f.status === "pending" && <Field label="Prazo para pedir" type="date" hint="Avisamos 7 e 2 dias antes." value={f.dueOn} onChange={(e) => set("dueOn", e.target.value)} />}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="doc-obs" className="text-sm font-medium text-body">Observações</label>
        <textarea id="doc-obs" rows={2} maxLength={2000} value={f.notes} onChange={(e) => set("notes", e.target.value)}
          className="rounded-md border border-border-input bg-bg px-3 py-2 text-sm text-text" />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-sm">
            Apagar o documento e o arquivo?
            <Button variant="danger" size="sm" loading={pending} onClick={remove}>Apagar</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Não</Button>
          </span>
        ) : (
          <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>Apagar</Button>
        )}
        <span className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={pending}>Salvar</Button>
        </span>
      </div>
    </form>
  );
}

// Criar ou editar uma pasta: nome e prazo padrão (dias depois da data do documento)
export function FolderDialog({ folder, open, onClose, onChanged }: { folder: DocFolder | "new" | null; open: boolean; onClose: () => void; onChanged: (created?: DocFolder) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={folder === "new" ? "Nova pasta" : "Pasta"}>
      {folder && <FolderForm key={folder === "new" ? "new" : folder.id} folder={folder} onClose={onClose} onChanged={onChanged} />}
    </Dialog>
  );
}

function FolderForm({ folder, onClose, onChanged }: { folder: DocFolder | "new"; onClose: () => void; onChanged: (created?: DocFolder) => void }) {
  const existing = folder === "new" ? null : folder;
  const [name, setName] = useState(existing?.name ?? "");
  const [days, setDays] = useState(existing?.deadlineDays ? String(existing.deadlineDays) : "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    const deadlineDays = days.trim() ? Number(days) : null;
    if (deadlineDays !== null && (!Number.isInteger(deadlineDays) || deadlineDays < 1 || deadlineDays > 730)) return setError("O prazo é um número de dias, de 1 a 730.");
    if (!name.trim()) return setError("Dê um nome para a pasta.");
    setError(null);
    start(async () => {
      try {
        const result = existing ? await updateDocFolder(existing.id, { name, deadlineDays }) : await createDocFolder({ name, deadlineDays });
        if (!result.ok) return setError(result.error);
        onChanged(result.folder ?? undefined);
        onClose();
      } catch (err) { setError(message(err, "Não deu para salvar a pasta. Tente de novo.")); }
    });
  }

  function remove() {
    if (!existing) return;
    start(async () => {
      try { await deleteDocFolder(existing.id); onChanged(); onClose(); }
      catch (err) { setError(message(err, "Não deu para apagar a pasta.")); }
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <Field label="Nome da pasta" placeholder="Viagem SP, Convênio…" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <Field label="Prazo para pedir o reembolso (dias)" inputMode="numeric" placeholder="30" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
        hint="Conta a partir da data de cada nota. Deixe vazio se não houver prazo." />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {existing ? (
          confirmDelete ? (
            <span className="flex items-center gap-2 text-sm">
              Apagar a pasta? Os documentos ficam sem pasta.
              <Button variant="danger" size="sm" loading={pending} onClick={remove}>Apagar</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Não</Button>
            </span>
          ) : <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>Apagar pasta</Button>
        ) : <span />}
        <span className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={pending}>Salvar</Button>
        </span>
      </div>
    </form>
  );
}
