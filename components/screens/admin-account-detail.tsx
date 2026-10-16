import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/load-error";
import { listAdminActions, loadAccounts } from "@/lib/admin-accounts";
import { loadAppConfig } from "@/lib/app-config";
import { forSale, type Plan } from "@/lib/plans";
import { loadPlans } from "@/lib/plans-server";
import { accountState, brDay, KIND_LABEL, untilText } from "@/lib/domain/accounts";
import { formatBytes } from "@/lib/limits";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { isSupportAdmin } from "@/lib/support";
import { DEFAULT_TZ, localDate } from "@/lib/time";
import { AccountControls } from "./admin-account-controls";
import { StateChip } from "./admin-accounts-list";

const actionText = (names: Record<string, string>): Record<string, (d: Record<string, unknown>) => string> => ({
  "plano manual": (d) => `Plano manual ${String(names[String(d.plan)] ?? d.plan).toLowerCase()} até ${brDay(String(d.until))}`,
  "plano manual encerrado": () => "Plano manual encerrado",
  teste: (d) => `Teste até ${brDay(String(d.after))} (era ${brDay(String(d.before))})`,
  "conta excluída": () => "Conta excluída",
});
const when = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: DEFAULT_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// Uma conta: situação, uso e as ações do time (plano manual, teste, excluir), com o registro do que já foi feito
export async function AdminAccountScreen({ id }: { id: string }) {
  const user = isSupabaseConfigured() ? await currentUser() : null;
  if (!user || !isSupportAdmin(user.email)) notFound();
  await loadAppConfig();
  const row = (await loadAccounts()).find((r) => r.userId === id);
  if (!row) notFound();
  const today = localDate(new Date(), DEFAULT_TZ);
  const plans = await loadPlans();
  const names = Object.fromEntries(plans.map((p: Plan) => [p.id, p.name]));
  const ACTION_TEXT = actionText(names);
  const state = accountState(row, today, names);
  const actions = await listAdminActions(id);
  const paidByAsaas = (state.kind === "paid" || state.kind === "canceling" || state.kind === "past_due") && !state.manual;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/contas" className="inline-flex w-fit items-center gap-1.5 text-sm text-body hover:text-text"><ArrowLeft aria-hidden className="size-4" />Todas as contas</Link>
      <PageHeader id="admin-conta" title={row.name ?? "Sem nome"}>
        <StateChip row={row} today={today} names={names} />
      </PageHeader>
      <p className="-mt-3 text-sm text-muted">{row.email ?? "sem e-mail"}</p>

      <Card className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <SectionLabel className="sm:col-span-2">Situação</SectionLabel>
        <Info label="Plano" value={state.plan ? `${state.label}${state.manual ? " (manual)" : ""} · ${KIND_LABEL[state.kind].toLowerCase()}` : state.label} />
        <Info label={state.plan ? "Vale até" : "Teste até"} value={`${brDay(state.until)}${untilText(state.daysLeft) ? ` · ${untilText(state.daysLeft)}` : ""}`} />
        <Info label="Teste grátis até" value={brDay(row.trialEndsOn)} />
        <Info label="Conta criada em" value={brDay(row.createdAt)} />
        <Info label="Último acesso" value={row.lastSignInAt ? when(row.lastSignInAt) : "nunca entrou"} />
        <Info label="Última mensagem" value={row.lastMessageAt ? when(row.lastMessageAt) : "nenhuma"} />
        <Info label="Mensagens em 30 dias" value={String(row.messages30d)} />
        <Info label="WhatsApp vinculados" value={String(row.whatsapps)} />
        <Info label="Documentos" value={`${row.documents} · ${formatBytes(row.storageBytes)}`} />
        <Info label="Código da conta" value={row.userId} mono />
      </Card>

      {paidByAsaas && (
        <p role="note" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-body">
          Esta assinatura é paga pela Asaas e se renova sozinha. Dar um plano manual aqui vale em cima dela (o mais novo manda), mas não cancela nem estorna nada na Asaas.
        </p>
      )}

      <AccountControls userId={row.userId} email={row.email ?? ""} manual={state.manual && state.kind !== "expired"} plan={state.plan} until={state.until} trialEndsOn={row.trialEndsOn} today={today} plans={forSale(plans).concat(plans.filter((p) => p.kind === "paid" && !p.active)).map((p) => ({ id: p.id, name: p.name, active: p.active }))} isTeam={isSupportAdmin(row.email)} />

      <Card className="flex flex-col gap-2">
        <SectionLabel>Registro desta conta</SectionLabel>
        {actions.length === 0 ? <p className="text-sm text-muted">Ninguém do time mexeu nesta conta ainda.</p> : (
          <ul className="flex flex-col divide-y divide-border">
            {actions.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <span className="text-text">{(ACTION_TEXT[a.action] ?? (() => a.action))(a.detail)}</span>
                <span className="text-xs text-muted">{when(a.createdAt)} · por {a.adminEmail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={mono ? "break-all font-mono text-xs text-text" : "text-sm text-text"}>{value}</span>
    </div>
  );
}
