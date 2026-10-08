import { Bell, ChevronRight, CreditCard, Sparkles } from "lucide-react";
import Link from "next/link";
import { cancelPlan } from "@/app/actions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/load-error";
import { PLANS } from "@/lib/plans";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { serverContext } from "@/lib/server";
import { formatMoney, formatShortDate } from "@/lib/time";
import { AssistantForm, SettingsForm } from "./settings-forms";

function LinkRow({ href, icon: Icon, title, hint }: { href: string; icon: typeof Bell; title: string; hint: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
      <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-body"><Icon className="size-4" /></span>
      <span className="flex min-w-0 flex-1 flex-col"><span className="text-sm font-medium text-text">{title}</span><span className="text-xs text-muted">{hint}</span></span>
      <ChevronRight aria-hidden className="size-4 text-muted" />
    </Link>
  );
}

// ---- S29 ----
export async function SettingsScreen() {
  const { store, today } = await serverContext();
  const [settings, notices] = await Promise.all([store.getSettings(), store.listNotices()]);
  const unread = notices.filter((n) => !n.readAt).length;
  const end = settings.billing?.periodEnd ? formatShortDate(settings.billing.periodEnd.slice(0, 10)) : null;
  const plan = settings.billing?.pastDue ? "Pagamento atrasado: atualize o cartão para não perder o acesso"
    : settings.billing && settings.plan !== "trial" && settings.plan !== "none"
    ? `Plano ${PLANS[settings.plan].name.toLowerCase()} · ${settings.billing.renews ? `renova em ${end}` : `vale até ${end}, sem renovar`}`
    : settings.plan === "trial"
    ? `Teste grátis${settings.trialEndsOn ? ` até ${formatShortDate(settings.trialEndsOn)}${settings.trialEndsOn < today ? " (terminou)" : ""}` : ""}`
    : settings.plan === "none" ? "Sem assinatura"
    : `Plano ${PLANS[settings.plan].name.toLowerCase()} · ${formatMoney(PLANS[settings.plan].priceCents)} ${PLANS[settings.plan].period}`;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S29" title="Ajustes" />
      <Card className="divide-y divide-border p-0">
        <LinkRow href="/planos" icon={CreditCard} title="Assinatura" hint={plan} />
        <LinkRow href="/ajustes/assistente" icon={Sparkles} title="Jeito do assistente" hint="tom, voz, memória e tema" />
        <LinkRow href="/avisos" icon={Bell} title="Avisos" hint={unread ? `${unread} novo${unread === 1 ? "" : "s"}` : "tudo lido"} />
      </Card>
      {settings.billing?.renews && (
        <form action={cancelPlan} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-body">Cancelar é imediato: para de cobrar e o acesso continua até {end}.</span>
          <button type="submit" className="h-8 rounded-md border border-border px-3 text-sm font-medium text-text hover:bg-surface-2">Cancelar assinatura</button>
        </form>
      )}
      <SettingsForm initial={settings} canSignOut={isSupabaseConfigured()} />
    </div>
  );
}

// ---- S30 ----
export async function AssistantSettingsScreen() {
  const { store } = await serverContext();
  const settings = await store.getSettings();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/ajustes" className="text-sm font-medium text-info hover:underline">← Ajustes</Link>
        <PageHeader id="S30" title="Jeito do assistente" />
      </div>
      <AssistantForm initial={settings} />
    </div>
  );
}
