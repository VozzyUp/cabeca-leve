import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/load-error";
import { loadAccounts } from "@/lib/admin-accounts";
import { loadAppConfig } from "@/lib/app-config";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { isSupportAdmin } from "@/lib/support";
import { DEFAULT_TZ, localDate } from "@/lib/time";
import { AccountsList } from "./admin-accounts-list";

// Contas e planos: todas as contas, em que situação estão e quem precisa de atenção. Só e-mails em ADMIN_EMAILS.
export async function AdminAccountsScreen() {
  const user = isSupabaseConfigured() ? await currentUser() : null;
  if (!user || !isSupportAdmin(user.email)) notFound();
  await loadAppConfig();
  let rows: Awaited<ReturnType<typeof loadAccounts>>;
  try { rows = await loadAccounts(); }
  catch (error) {
    console.error("contas não carregaram", (error as Error).message);
    return (
      <div className="flex flex-col gap-6">
        <PageHeader id="admin-contas" title="Contas e planos" />
        <p role="alert" className="max-w-prose rounded-lg border border-danger px-4 py-3 text-sm text-text">
          Não deu para ler as contas. Se você acabou de atualizar o app, falta rodar no banco a migração das contas
          (<span className="font-mono">supabase/colar-no-sql-editor/29_contas_do_time.sql</span>, ou o segredo <span className="font-mono">SUPABASE_DB_URL</span> no GitHub para aplicar sozinha).
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="admin-contas" title="Contas e planos" />
      <AccountsList rows={rows} today={localDate(new Date(), DEFAULT_TZ)} />
    </div>
  );
}
