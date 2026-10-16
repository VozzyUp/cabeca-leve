import { notFound } from "next/navigation";
import { Card, SectionLabel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/load-error";
import { listPlanActions, planUsage, type PlanUsage } from "@/lib/admin-plans";
import { loadAppConfig } from "@/lib/app-config";
import { centsToInput, monthsText, planPeriod, storageText } from "@/lib/plans";
import { loadPlans } from "@/lib/plans-server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { isSupportAdmin } from "@/lib/support";
import { DEFAULT_TZ } from "@/lib/time";
import { PlansManager } from "./admin-plans-manager";

const LABEL: Record<string, string> = {
  name: "nome", tagline: "frase curta", priceCents: "preço", months: "duração", recurring: "cobrança", whatsappLimit: "WhatsApps", messagesPerDay: "mensagens por dia",
  storageMb: "espaço", featured: "destaque", active: "à venda", sort: "ordem",
};
const show = (field: string, v: unknown): string => {
  if (v === null || v === undefined || v === "") return "vazio";
  if (field === "priceCents") return `R$ ${centsToInput(Number(v))}`;
  if (field === "months") return monthsText(Number(v));
  if (field === "recurring") return v ? "renova no cartão" : "pagamento único";
  if (field === "storageMb") return storageText(Number(v));
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v);
};

function describe(action: string, d: Record<string, unknown>): string {
  if (action === "plano criado") return `Criou o plano ${d.name} (R$ ${centsToInput(Number(d.priceCents))} ${planPeriod({ months: Number(d.months) as 1, recurring: !!d.recurring })})`;
  if (action === "plano excluído") return `Excluiu o plano ${d.name}`;
  if (action === "plano editado" || action === "teste grátis editado") {
    const changes = Object.entries((d.changes ?? {}) as Record<string, [unknown, unknown]>).map(([f, [a, b]]) => `${LABEL[f] ?? f}: ${show(f, a)} → ${show(f, b)}`);
    return `${action === "teste grátis editado" ? "Teste grátis" : `Plano ${d.name}`}: ${changes.join("; ")}`;
  }
  return action;
}

const when = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: DEFAULT_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// Planos e limites (só ADMIN_EMAILS): valores, duração, limites de uso, criar, tirar da venda e excluir
export async function AdminPlansScreen() {
  const user = isSupabaseConfigured() ? await currentUser() : null;
  if (!user || !isSupportAdmin(user.email)) notFound();
  await loadAppConfig();
  const [plans, usage, actions] = await Promise.all([loadPlans(), planUsage().catch((): Record<string, PlanUsage> => ({})), listPlanActions().catch(() => [])]);
  const managed = plans.map((p) => {
    const u = usage[p.id];
    return { ...p, used: (u?.subscriptions ?? 0) + (u?.checkouts ?? 0), activeSubs: u?.active ?? 0 };
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="admin-planos" title="Planos e limites" />
      <PlansManager plans={managed} />
      <Card className="flex flex-col gap-2">
        <SectionLabel>Registro dos planos</SectionLabel>
        {actions.length === 0 ? <p className="text-sm text-muted">Ninguém do time mexeu nos planos ainda.</p> : (
          <ul className="flex flex-col divide-y divide-border">
            {actions.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <span className="text-text">{describe(a.action, a.detail)}</span>
                <span className="text-xs text-muted">{when(a.createdAt)} · por {a.adminEmail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
