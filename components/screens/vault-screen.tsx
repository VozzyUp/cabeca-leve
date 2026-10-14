"use client";
import { Copy, Eye, EyeOff, ExternalLink, KeyRound, Lock, Pencil, Plus, ShieldCheck, Trash2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { changeVaultPassword, createVault, deleteVaultItem, destroyVault, loadVault, saveVaultItem } from "@/app/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/load-error";
import type { VaultMeta, VaultRecord } from "@/lib/data/store";
import {
  checkVerifier, deriveKey, generatePassword, makeVerifier, newSalt, openItem, sealItem, strength, VAULT_ITERATIONS, type VaultItem,
} from "@/lib/vault-crypto";

// Cofre de senhas. A senha mestra e a chave só existem nesta tela, na memória do navegador:
// o servidor recebe e devolve só texto cifrado. Tranca sozinho depois de 5 minutos parado.
const IDLE_MS = 5 * 60_000;
const CLEAR_CLIPBOARD_MS = 30_000;
const EMPTY: VaultItem = { title: "", url: "", username: "", password: "", notes: "" };

type Open = { id: string; item: VaultItem };
type Loaded = { meta: VaultMeta | null; items: VaultRecord[] };

export function VaultScreen() {
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [items, setItems] = useState<Open[]>([]);
  const lock = useCallback(() => { setKey(null); setItems([]); }, []);

  useEffect(() => { loadVault().then(setData).catch(() => setLoadError(true)); }, []);

  // trava sozinho se ninguém mexer por 5 minutos
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!key) return;
    const reset = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(lock, IDLE_MS); };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { events.forEach((e) => window.removeEventListener(e, reset)); if (timer.current) clearTimeout(timer.current); };
  }, [key, lock]);

  async function unlocked(k: CryptoKey, records: VaultRecord[]) {
    const opened = await Promise.all(records.map(async (r) => ({ id: r.id, item: await openItem(k, r) })));
    setItems(opened.filter((o): o is Open => !!o.item).sort((a, b) => a.item.title.localeCompare(b.item.title, "pt-BR")));
    setKey(k);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S40" title="Cofre de senhas">
        {key && <Button variant="secondary" icon={<Lock className="size-4" />} onClick={lock}>Trancar</Button>}
      </PageHeader>
      <p className="flex max-w-2xl items-start gap-2 text-sm text-body">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
        Tudo é cifrado neste aparelho com a sua senha mestra antes de ir para o servidor. Ninguém do time nem o assistente consegue ler, e
        o assistente não guarda senhas pela conversa.
      </p>
      {loadError && <p role="alert" className="text-sm text-danger">Não deu para abrir o cofre agora. Recarregue a página.</p>}
      {!data && !loadError && <p className="text-sm text-muted">Carregando…</p>}
      {data && !data.meta && <CreateVault onCreated={(k, meta) => { setData({ meta, items: [] }); setKey(k); }} />}
      {data?.meta && !key && <Unlock meta={data.meta} onReset={() => setData({ meta: null, items: [] })}
        onOpen={async (k) => { const fresh = await loadVault(); setData(fresh); await unlocked(k, fresh.items); }} />}
      {data?.meta && key && <VaultList vaultKey={key} items={items} setItems={setItems}
        onRekeyed={(k, meta) => { setKey(k); setData((d) => (d ? { ...d, meta } : d)); }} />}
    </div>
  );
}

function CreateVault({ onCreated }: { onCreated: (k: CryptoKey, meta: VaultMeta) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const level = password ? strength(password) : null;
  return (
    <Card className="flex max-w-lg flex-col gap-4">
      <h2 className="text-lg font-semibold text-text">Crie a sua senha mestra</h2>
      <p className="text-sm text-body">É a única senha que você vai precisar lembrar. <strong className="text-text">Se esquecer, não há como recuperar</strong>: nem nós temos acesso. Anote num lugar seguro.</p>
      <form className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault();
        if (password.length < 10) return setError("Use pelo menos 10 caracteres.");
        if (password !== confirm) return setError("As duas senhas não são iguais.");
        setError(null);
        start(async () => {
          try {
            const salt = newSalt();
            const k = await deriveKey(password, salt, VAULT_ITERATIONS);
            const meta = { salt, iterations: VAULT_ITERATIONS, verifier: await makeVerifier(k) };
            await createVault(meta);
            onCreated(k, meta);
          } catch { setError("Não deu para criar o cofre. Tente de novo."); }
        });
      }}>
        <Field label="Senha mestra" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
          hint={level ? `Força: ${level}` : "Pelo menos 10 caracteres. Uma frase longa é ótima."} />
        <Field label="Repita a senha mestra" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error ?? undefined} />
        <Button type="submit" loading={pending} icon={<KeyRound className="size-4" />}>Criar o cofre</Button>
      </form>
    </Card>
  );
}

function Unlock({ meta, onOpen, onReset }: { meta: VaultMeta; onOpen: (k: CryptoKey) => Promise<void>; onReset: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [forgot, setForgot] = useState(false);
  const [confirm, setConfirm] = useState("");
  return (
    <Card className="flex max-w-lg flex-col gap-4">
      <h2 className="text-lg font-semibold text-text">Cofre trancado</h2>
      <form className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const k = await deriveKey(password, meta.salt, meta.iterations);
          if (!(await checkVerifier(k, meta.verifier))) { setError("Senha mestra errada."); return; }
          setPassword("");
          await onOpen(k);
        });
      }}>
        <Field label="Senha mestra" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error ?? undefined} autoFocus />
        <Button type="submit" loading={pending} icon={<Lock className="size-4" />} disabled={!password}>Destrancar</Button>
      </form>
      <button type="button" className="w-fit text-xs text-muted underline" onClick={() => setForgot((f) => !f)}>Esqueci a senha mestra</button>
      {forgot && (
        <form className="flex flex-col gap-3 rounded-md border border-danger p-3" onSubmit={(e) => {
          e.preventDefault();
          start(async () => { try { await destroyVault(confirm); onReset(); } catch { setError("Não deu para apagar. Confira a confirmação."); } });
        }}>
          <p className="text-sm text-body">Sem a senha mestra não há como abrir os itens, nem por nós. Você pode apagar o cofre e começar outro do zero. Tudo o que está nele se perde.</p>
          <Field label='Digite "APAGAR" para confirmar' value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" variant="danger" disabled={confirm.trim().toUpperCase() !== "APAGAR"} icon={<Trash2 className="size-4" />}>Apagar o cofre</Button>
        </form>
      )}
    </Card>
  );
}

function VaultList({ vaultKey, items, setItems, onRekeyed }: {
  vaultKey: CryptoKey; items: Open[]; setItems: (fn: (i: Open[]) => Open[]) => void; onRekeyed: (k: CryptoKey, meta: VaultMeta) => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Open | "new" | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [rekey, setRekey] = useState(false);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(({ item }) => [item.title, item.url, item.username].some((x) => x.toLowerCase().includes(q))) : items;
  }, [items, query]);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNote(`${what} copiado. A área de transferência é limpa em 30 segundos.`);
      setTimeout(() => { navigator.clipboard.writeText("").catch(() => {}); setNote(null); }, CLEAR_CLIPBOARD_MS);
    } catch { setNote("O navegador não deixou copiar. Mostre a senha e copie à mão."); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Buscar" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="site, nome ou login" className="min-w-48 flex-1" />
        <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Novo item</Button>
      </div>
      {note && <p role="status" className="text-xs text-muted">{note}</p>}
      {items.length === 0 ? (
        <EmptyState icon={<KeyRound className="size-8" />} title="Cofre vazio" text="Guarde aqui logins e senhas: site, usuário, senha e uma observação." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {shown.map(({ id, item }) => (
            <li key={id} className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-text">{item.title || "Sem nome"}</span>
                  <span className="truncate text-xs text-muted">{[item.username, hostOf(item.url)].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="flex items-center gap-1">
                  {item.url && <a href={safeUrl(item.url)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${item.title}`}
                    className="flex size-10 items-center justify-center rounded-md text-body hover:bg-surface-2"><ExternalLink aria-hidden className="size-4" /></a>}
                  {item.username && <IconButton label={`Copiar login de ${item.title}`} onClick={() => copy(item.username, "Login")}><Copy className="size-4" /></IconButton>}
                  <IconButton label={`Copiar senha de ${item.title}`} onClick={() => copy(item.password, "Senha")}><KeyRound className="size-4" /></IconButton>
                  <IconButton label={revealed === id ? `Esconder senha de ${item.title}` : `Mostrar senha de ${item.title}`} onClick={() => setRevealed((r) => (r === id ? null : id))}>
                    {revealed === id ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </IconButton>
                  <IconButton label={`Editar ${item.title}`} onClick={() => setEditing({ id, item })}><Pencil className="size-4" /></IconButton>
                </span>
              </div>
              {revealed === id && <p className="break-all font-mono text-sm text-text">{item.password}</p>}
              {item.notes && <p className="whitespace-pre-wrap text-xs text-body">{item.notes}</p>}
            </li>
          ))}
          {shown.length === 0 && <li className="p-4 text-sm text-muted">Nada encontrado para “{query}”.</li>}
        </ul>
      )}
      <button type="button" className="w-fit text-xs text-muted underline" onClick={() => setRekey(true)}>Trocar a senha mestra</button>
      <ItemDialog vaultKey={vaultKey} editing={editing} onClose={() => setEditing(null)}
        onSaved={(o) => setItems((list) => [...list.filter((x) => x.id !== o.id), o].sort((a, b) => a.item.title.localeCompare(b.item.title, "pt-BR")))}
        onDeleted={(id) => setItems((list) => list.filter((x) => x.id !== id))} />
      <RekeyDialog open={rekey} items={items} onClose={() => setRekey(false)} onDone={(k, meta) => { setRekey(false); onRekeyed(k, meta); setNote("Senha mestra trocada."); }} />
    </div>
  );
}

function ItemDialog({ vaultKey, editing, onClose, onSaved, onDeleted }: {
  vaultKey: CryptoKey; editing: Open | "new" | null; onClose: () => void; onSaved: (o: Open) => void; onDeleted: (id: string) => void;
}) {
  const existing = editing && editing !== "new" ? editing : null;
  const [form, setForm] = useState<VaultItem>(EMPTY);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // abre o formulário com o item escolhido (ou vazio)
  const [openedFor, setOpenedFor] = useState<Open | "new" | null>(null);
  if (editing !== openedFor) { setOpenedFor(editing); setForm(existing?.item ?? EMPTY); setShow(false); setError(null); }
  const set = (k: keyof VaultItem) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Dialog open={!!editing} onClose={onClose} title={existing ? "Editar item" : "Novo item"}>
      <form className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.password) { setError("Dê um nome e preencha a senha."); return; }
        start(async () => {
          try {
            const item = { ...form, title: form.title.trim(), url: form.url.trim(), username: form.username.trim() };
            const rec = await saveVaultItem(existing?.id ?? null, await sealItem(vaultKey, item));
            onSaved({ id: rec.id, item });
            onClose();
          } catch { setError("Não deu para salvar. Tente de novo."); }
        });
      }}>
        <Field label="Nome" value={form.title} onChange={set("title")} placeholder="Ex.: Banco, Netflix" maxLength={120} />
        <Field label="Endereço do site" value={form.url} onChange={set("url")} placeholder="https://" inputMode="url" maxLength={500} />
        <Field label="Login ou e-mail" value={form.username} onChange={set("username")} autoComplete="off" maxLength={200} />
        <div className="flex items-end gap-2">
          <Field label="Senha" type={show ? "text" : "password"} value={form.password} onChange={set("password")} autoComplete="new-password" className="flex-1"
            maxLength={500} hint={form.password ? `Força: ${strength(form.password)}` : undefined} />
          <IconButton label={show ? "Esconder a senha" : "Mostrar a senha"} className={form.password ? "mb-6" : undefined} onClick={() => setShow((s) => !s)}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </IconButton>
          <IconButton label="Gerar senha forte" className={form.password ? "mb-6" : undefined} onClick={() => { setForm((f) => ({ ...f, password: generatePassword() })); setShow(true); }}>
            <Wand2 className="size-4" />
          </IconButton>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-body">Observação
          <textarea value={form.notes} onChange={set("notes")} rows={3} maxLength={2000} className="rounded-md border border-border-input bg-bg px-3 py-2 text-sm text-text" />
        </label>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {existing ? (
            <Button variant="danger" disabled={pending} icon={<Trash2 className="size-4" />} onClick={() => {
              if (!window.confirm(`Apagar "${existing.item.title}" do cofre?`)) return;
              start(async () => { try { await deleteVaultItem(existing.id); onDeleted(existing.id); onClose(); } catch { setError("Não deu para apagar."); } });
            }}>Apagar</Button>
          ) : <span />}
          <Button type="submit" loading={pending}>Salvar</Button>
        </div>
      </form>
    </Dialog>
  );
}

function RekeyDialog({ open, items, onClose, onDone }: { open: boolean; items: Open[]; onClose: () => void; onDone: (k: CryptoKey, meta: VaultMeta) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onClose={onClose} title="Trocar a senha mestra">
      <form className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault();
        if (password.length < 10) return setError("Use pelo menos 10 caracteres.");
        if (password !== confirm) return setError("As duas senhas não são iguais.");
        setError(null);
        start(async () => {
          try {
            // tudo é recifrado aqui com a chave nova e enviado de uma vez
            const salt = newSalt();
            const k = await deriveKey(password, salt, VAULT_ITERATIONS);
            const meta = { salt, iterations: VAULT_ITERATIONS, verifier: await makeVerifier(k) };
            const sealed = await Promise.all(items.map(async (o) => ({ id: o.id, ...(await sealItem(k, o.item)) })));
            await changeVaultPassword(meta, sealed);
            setPassword(""); setConfirm("");
            onDone(k, meta);
          } catch { setError("Não deu para trocar. Tranque, abra de novo e tente outra vez."); }
        });
      }}>
        <Field label="Nova senha mestra" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
          hint={password ? `Força: ${strength(password)}` : undefined} />
        <Field label="Repita a nova senha mestra" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error ?? undefined} />
        <Button type="submit" loading={pending}>Trocar</Button>
      </form>
    </Dialog>
  );
}

function hostOf(url: string) {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return url; }
}
// só http(s): nada de javascript: num link vindo do cofre
function safeUrl(url: string) {
  try { const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "#"; } catch { return "#"; }
}
