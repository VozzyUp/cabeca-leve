import { LifeBuoy } from "lucide-react";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/load-error";
import { serverContext } from "@/lib/server";
import { formatDue, isSupportAdmin } from "@/lib/support";
import { currentUser, getAdmin } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AnswerForm, SupportForm } from "./support-forms";

const STATUS = { open: "aguardando resposta", answered: "respondido", closed: "encerrado" } as const;

// Falar com uma pessoa (F3): abrir chamado e ver as respostas
export async function SupportScreen() {
  const { store, tz } = await serverContext();
  const tickets = await store.listSupportTickets();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S29-suporte" title="Falar com uma pessoa" />
      <p className="max-w-prose text-body">
        Uma pessoa do time lê e responde em até 1 dia útil, aqui, no WhatsApp vinculado e por e-mail.
        Pela conversa também funciona: escreva &ldquo;quero falar com uma pessoa&rdquo;.
      </p>
      {isSupabaseConfigured() ? <SupportForm /> : <p className="text-sm text-muted">No modo de demonstração não há time de suporte.</p>}
      <section aria-labelledby="meus-chamados" className="flex flex-col gap-3">
        <h2 id="meus-chamados" className="text-label text-muted">Seus chamados</h2>
        {tickets.length === 0 ? (
          <EmptyState icon={<LifeBuoy className="size-8" />} title="Nenhum chamado ainda" text="Quando você abrir um, ele aparece aqui com o protocolo e a resposta." />
        ) : tickets.map((t) => (
          <Card key={t.id} className="flex flex-col gap-2">
            <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-mono text-text">{t.protocol}</span>
              <span className={t.status === "open" ? "text-warning" : "text-success"}>{STATUS[t.status]}</span>
            </p>
            <p className="whitespace-pre-wrap text-sm text-body">{t.message}</p>
            {t.reply ? (
              <div className="rounded-md bg-surface-2 p-3 text-sm">
                <p className="text-label text-muted">Resposta</p>
                <p className="mt-1 whitespace-pre-wrap text-text">{t.reply}</p>
              </div>
            ) : <p className="text-xs text-muted">Resposta até {formatDue(t.dueAt, tz)}</p>}
          </Card>
        ))}
      </section>
    </div>
  );
}

// Painel do time: chamados abertos, do prazo mais curto ao mais longo. Só ADMIN_EMAILS entra.
export async function SupportAdminScreen() {
  const user = isSupabaseConfigured() ? await currentUser() : null;
  if (!user || !isSupportAdmin(user.email)) notFound();
  const db = getAdmin();
  const { data: open } = await db.from("support_tickets").select("id, user_id, protocol, channel, message, due_at, created_at").eq("status", "open").order("due_at").limit(100);
  const emails = new Map<string, string>();
  for (const id of new Set((open ?? []).map((t) => t.user_id))) {
    const { data } = await db.auth.admin.getUserById(id);
    emails.set(id, data.user?.email ?? "");
  }
  const now = new Date().toISOString();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="suporte-painel" title="Chamados abertos" />
      {(open ?? []).length === 0 ? (
        <EmptyState icon={<LifeBuoy className="size-8" />} title="Nada aberto" text="Todos os chamados foram respondidos." />
      ) : (open ?? []).map((t) => (
        <Card key={t.id} className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span><span className="font-mono text-text">{t.protocol}</span> · {emails.get(t.user_id)} · {t.channel}</span>
            <span className={t.due_at < now ? "text-danger" : "text-muted"}>{t.due_at < now ? "prazo vencido" : `até ${formatDue(t.due_at)}`}</span>
          </p>
          <p className="whitespace-pre-wrap text-sm text-body">{t.message}</p>
          <AnswerForm ticketId={t.id} protocol={t.protocol} />
        </Card>
      ))}
    </div>
  );
}
