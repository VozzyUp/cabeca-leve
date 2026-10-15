import { ChevronRight, Coins, Inbox, KeyRound, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/load-error";
import { loadAccounts } from "@/lib/admin-accounts";
import { loadAppConfig } from "@/lib/app-config";
import { summarizeAccounts } from "@/lib/domain/accounts";
import { ADMIN_LINKS } from "@/lib/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser, getAdmin } from "@/lib/supabase/server";
import { isSupportAdmin } from "@/lib/support";
import { DEFAULT_TZ, localDate } from "@/lib/time";

const ICON: Record<string, LucideIcon> = { "/admin/contas": Users, "/suporte/painel": Inbox, "/admin/custos": Coins, "/admin/configuracoes": KeyRound };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Administração: tudo que é só do time, separado dos ajustes de quem usa o app. Só e-mails em ADMIN_EMAILS.
export async function AdminHomeScreen() {
  const user = isSupabaseConfigured() ? await currentUser() : null;
  if (!user || !isSupportAdmin(user.email)) notFound();
  await loadAppConfig();

  // um número de relance em cada porta; se não carregar, fica o texto de sempre
  const hints: Record<string, string> = {};
  try {
    const s = summarizeAccounts(await loadAccounts(), localDate(new Date(), DEFAULT_TZ));
    hints["/admin/contas"] = `${plural(s.total, "conta", "contas")} · ${s.trial} em teste · ${s.attention} ${s.attention === 1 ? "pede" : "pedem"} atenção`;
  } catch (error) { console.error("resumo das contas não carregou", (error as Error).message); }
  try {
    const { count } = await getAdmin().from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open");
    if (count !== null) hints["/suporte/painel"] = count === 0 ? "nenhum chamado esperando resposta" : `${plural(count, "chamado esperando", "chamados esperando")} resposta`;
  } catch (error) { console.error("chamados não contaram", (error as Error).message); }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="admin-inicio" title="Administração" />
      <p className="max-w-prose text-sm text-body">Só o time vê esta área. Os ajustes de quem usa o app ficam em Configurações.</p>
      <Card className="divide-y divide-border p-0">
        {ADMIN_LINKS.map((l) => {
          const Icon = ICON[l.href];
          return (
            <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-body"><Icon className="size-4" /></span>
              <span className="flex min-w-0 flex-1 flex-col"><span className="text-sm font-medium text-text">{l.label}</span><span className="text-xs text-muted">{hints[l.href] ?? l.hint}</span></span>
              <ChevronRight aria-hidden className="size-4 text-muted" />
            </Link>
          );
        })}
      </Card>
    </div>
  );
}
