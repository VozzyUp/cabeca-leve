import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/load-error";
import { CONFIG_GROUPS, configStatus, loadAppConfig } from "@/lib/app-config";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { isSupportAdmin } from "@/lib/support";
import { AdminConfigForm, IntegrationInfo } from "./admin-config-form";

// Configuração do sistema: as chaves dos serviços, guardadas no banco e criptografadas.
// Só os e-mails em ADMIN_EMAILS (variável do stack) entram aqui.
export async function AdminConfigScreen() {
  const user = isSupabaseConfigured() ? await currentUser() : null;
  if (!user || !isSupportAdmin(user.email)) notFound();
  const missingKey = !process.env.APP_SECRET_KEY || process.env.APP_SECRET_KEY.length < 32;
  if (!missingKey) await loadAppConfig(true);
  const status = missingKey ? [] : await configStatus();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="admin-config" title="Configuração do sistema" />
      {missingKey ? (
        <p role="alert" className="rounded-lg border border-danger px-4 py-3 text-sm text-text">
          Falta a variável <span className="font-mono">APP_SECRET_KEY</span> no stack (pelo menos 32 caracteres; gere com
          <span className="font-mono"> openssl rand -hex 32</span>). Ela criptografa as chaves guardadas aqui.
        </p>
      ) : (
        <>
          <p className="max-w-prose text-body">
            As chaves ficam no banco, criptografadas, e valem na hora, sem reiniciar. O que estiver aqui vale mais que a variável do stack.
            Segredos aparecem só com os 4 últimos caracteres; para trocar, digite o valor novo.
          </p>
          <IntegrationInfo version={status.filter((s) => s.key.endsWith("_SECRET") || s.key.endsWith("_TOKEN")).map((s) => `${s.key}:${s.preview}`).join("|")} />
          {CONFIG_GROUPS.map((g) => <AdminConfigForm key={g.title} group={g} status={status.filter((s) => g.fields.some((f) => f.key === s.key))} />)}
        </>
      )}
    </div>
  );
}
