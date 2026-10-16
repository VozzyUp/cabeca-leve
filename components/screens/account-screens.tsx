import { Bell, ChevronRight, CreditCard, FileText, LifeBuoy, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/load-error";
import { planPeriod } from "@/lib/plans";
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
  const settings = await store.getSettings();
  const end = settings.billing?.periodEnd ? formatShortDate(settings.billing.periodEnd.slice(0, 10)) : null;
  const plan = settings.billing?.confirming ? "Pagamento em confirmação: tudo liberado enquanto a Asaas confirma"
    : settings.billing?.pastDue ? "Pagamento atrasado: atualize o cartão para não perder o acesso"
    : settings.billing && settings.plan !== "trial" && settings.plan !== "none"
    ? `Plano ${settings.planInfo.name.toLowerCase()} · ${settings.billing.renews ? `renova em ${end}` : `vale até ${end}, sem renovar`}`
    : settings.plan === "trial"
    ? `Teste grátis${settings.trialEndsOn ? ` até ${formatShortDate(settings.trialEndsOn)}${settings.trialEndsOn < today ? " (terminou)" : ""}` : ""}`
    : settings.plan === "none" ? "Sem assinatura"
    : `Plano ${settings.planInfo.name.toLowerCase()} · ${formatMoney(settings.planInfo.priceCents)} ${planPeriod(settings.planInfo)}`;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S29" title="Configurações" />
      <Card className="divide-y divide-border p-0">
        <LinkRow href="/ajustes/plano" icon={CreditCard} title="Meu plano" hint={plan} />
        <LinkRow href="/ajustes/assistente" icon={Sparkles} title="Configurar assistente" hint="tom, voz, memória e tema" />
        <LinkRow href="/ajustes/suporte" icon={LifeBuoy} title="Suporte humano" hint="resposta de alguém do time em até 1 dia útil" />
        <LinkRow href="/privacidade" icon={ShieldCheck} title="Política de privacidade" hint="o que guardamos e como você controla" />
        <LinkRow href="/termos" icon={FileText} title="Termos de uso" hint="as regras do serviço" />
      </Card>
      <SettingsForm initial={settings} canSignOut={isSupabaseConfigured()} />
    </div>
  );
}

// ---- S30 ----
export async function AssistantSettingsScreen() {
  const { store } = await serverContext();
  const [settings, memories] = await Promise.all([store.getSettings(), store.listMemories()]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <PageHeader id="S30" title="Configurar assistente" />
      </div>
      <AssistantForm initial={settings} memories={memories} />
    </div>
  );
}
