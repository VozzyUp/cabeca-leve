import { CalendarClock, Check, FileText, MessageCircle, Smartphone } from "lucide-react";
import Link from "next/link";
import { cancelPlan, startCheckout } from "@/app/actions";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { PageHeader } from "@/components/ui/load-error";
import { BRAND } from "@/lib/brand";
import { periodRange } from "@/lib/ai-costs";
import { daysBetween } from "@/lib/domain/accounts";
import { formatBytes, limitsFor } from "@/lib/limits";
import { checkoutLabel, forSale, isUpgrade, perMonthCents, planPeriod, planSaving, storageText, waText, type Plan } from "@/lib/plans";
import { loadPlans } from "@/lib/plans-server";
import { serverContext } from "@/lib/server";
import { formatMoney } from "@/lib/time";

const longDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
};

const daysText = (n: number) => (n < 0 ? "já passou" : n === 0 ? "termina hoje" : n === 1 ? "falta 1 dia" : n > 365 * 5 ? "" : `faltam ${n} dias`);

type Tone = "ok" | "warn" | "off";
const TONE: Record<Tone, string> = { ok: "bg-accent text-on-accent", warn: "border border-warning text-warning", off: "border border-border text-muted" };

// Uma barra de uso. Passou de 90%: vermelho, e o texto diz o que fazer
function Meter({ icon: Icon, label, used, limit, usedText, limitText }: { icon: typeof Check; label: string; used: number; limit: number; usedText: string; limitText: string }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-body"><Icon aria-hidden className="size-4 text-muted" />{label}</span>
        <span className="text-text"><strong>{usedText}</strong> <span className="text-muted">de {limitText}</span></span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full rounded-full", percent >= 90 ? "bg-danger" : "bg-accent")} style={{ width: `${percent}%` }} />
      </div>
    </li>
  );
}

function Limits({ plan }: { plan: Plan }) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-body">
      <li className="flex items-center gap-2"><Check aria-hidden className="size-4 shrink-0 text-success" />{waText(plan.whatsappLimit, true)}</li>
      <li className="flex items-center gap-2"><Check aria-hidden className="size-4 shrink-0 text-success" />{plan.messagesPerDay.toLocaleString("pt-BR")} mensagens por dia</li>
      <li className="flex items-center gap-2"><Check aria-hidden className="size-4 shrink-0 text-success" />{storageText(plan.storageMb)} para documentos</li>
    </ul>
  );
}

// Meu plano: o que a pessoa tem, até quando vale, quanto já usou e como mudar
export async function MyPlanScreen() {
  const { store, today, now } = await serverContext({ allowLocked: true });
  const dayStart = periodRange("hoje", now, store.timezone()).from.toISOString();
  const [settings, plans, messagesToday, storageUsed] = await Promise.all([
    store.getSettings(), loadPlans(), store.countUserMessagesSince(dayStart), store.documentBytesUsed(),
  ]);
  const plan = settings.planInfo;
  const billing = settings.billing;
  const paid = settings.plan !== "trial" && settings.plan !== "none";
  const end = billing?.periodEnd ? billing.periodEnd.slice(0, 10) : null;
  const trialLeft = settings.trialEndsOn ? daysBetween(today, settings.trialEndsOn) : null;
  const endLeft = end ? daysBetween(today, end) : null;

  let status: { label: string; tone: Tone };
  if (billing?.confirming) status = { label: "Pagamento em confirmação", tone: "warn" };
  else if (paid && billing?.pastDue) status = { label: "Pagamento atrasado", tone: "warn" };
  else if (paid && billing?.canceledAt) status = { label: "Cancelado", tone: "off" };
  else if (paid) status = { label: plan.recurring ? "Ativo" : "Pago", tone: "ok" };
  else if (settings.plan === "trial") status = { label: "Teste grátis", tone: "ok" };
  else status = { label: "Sem assinatura", tone: "off" };

  const selling = forSale(plans);
  const messageLimit = limitsFor(plan).messagesPerDay;
  const storageLimit = plan.storageMb * 1024 * 1024;
  const whatsappUsed = settings.whatsapp?.numbers.length ?? (settings.channels.whatsapp ? 1 : 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S42" title="Meu plano" />

      {settings.plan === "none" && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-warning bg-surface p-5">
          <h2 className="text-lg font-semibold text-text">Seu teste grátis terminou</h2>
          <p className="text-sm text-body">Para voltar a usar o {BRAND.name}, escolha um plano abaixo. Tudo o que você anotou continua guardado e volta assim que o plano começar.</p>
          <p className="text-sm text-body">Enquanto isso, só ficam abertas a conta, a cobrança e o suporte.</p>
          <div><Link href="/ajustes/suporte" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-text hover:bg-surface-2">Falar com uma pessoa</Link></div>
        </div>
      )}

      {settings.plan !== "none" && (
        <>
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-text">{paid || billing?.confirming ? `Plano ${plan.name.toLowerCase()}` : settings.plan === "trial" ? "Teste grátis" : "Você não tem um plano ativo"}</h2>
                {paid && <p className="text-sm text-body"><span className="font-mono text-text">{formatMoney(plan.priceCents)}</span> {planPeriod(plan)}</p>}
              </div>
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", TONE[status.tone])}>{status.label}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {paid && end && (
                <div className="flex items-start gap-3">
                  <CalendarClock aria-hidden className="mt-0.5 size-5 text-accent" />
                  <div>
                    <p className="text-xs text-muted">{billing?.renews ? "Próxima renovação" : "Vale até"}</p>
                    <p className="text-sm font-medium text-text">{longDay(end)}</p>
                    {endLeft !== null && daysText(endLeft) && <p className="text-xs text-muted">{daysText(endLeft)}</p>}
                  </div>
                </div>
              )}
              {settings.plan === "trial" && settings.trialEndsOn && (
                <div className="flex items-start gap-3">
                  <CalendarClock aria-hidden className="mt-0.5 size-5 text-accent" />
                  <div>
                    <p className="text-xs text-muted">O teste vai até</p>
                    <p className="text-sm font-medium text-text">{longDay(settings.trialEndsOn)}</p>
                    {trialLeft !== null && <p className="text-xs text-muted">{daysText(trialLeft)}</p>}
                  </div>
                </div>
              )}
            </div>

            {billing?.confirming && <p role="status" className="text-sm text-body">Estamos esperando a confirmação do pagamento. Tudo está liberado enquanto isso e a validade aparece aqui em seguida.</p>}
            {paid && billing?.pastDue && <p role="status" className="text-sm text-warning">A última cobrança não passou. Atualize o cartão para não perder o acesso.</p>}
            {paid && !billing?.canceledAt && !billing?.renews && !billing?.pastDue && <p className="text-sm text-body">Este plano é um pagamento único: não renova sozinho e nada mais será cobrado. Para continuar depois, contrate de novo antes de a data acabar.</p>}
            {billing?.canceledAt && (
              <p role="note" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-body">
                Assinatura cancelada em {longDay(billing.canceledAt)}, protocolo <span className="font-mono text-text">{billing.cancelProtocol}</span>. Nenhuma cobrança nova
                {end ? `; o acesso continua até ${longDay(end)}` : ""}. Se chegar alguma cobrança, ela é estornada sozinha.
              </p>
            )}
          </Card>

          <section aria-labelledby="uso" className="flex flex-col gap-3">
            <h2 id="uso" className="text-label text-muted">Seu uso e seus limites</h2>
            <Card className="p-5">
              <ul className="flex flex-col gap-4">
                <Meter icon={MessageCircle} label="Mensagens hoje" used={messagesToday} limit={messageLimit} usedText={String(messagesToday)} limitText={messageLimit.toLocaleString("pt-BR")} />
                <Meter icon={Smartphone} label="WhatsApps vinculados" used={whatsappUsed} limit={plan.whatsappLimit} usedText={String(whatsappUsed)} limitText={String(plan.whatsappLimit)} />
                <Meter icon={FileText} label="Espaço para documentos" used={storageUsed} limit={storageLimit} usedText={storageUsed === 0 ? "0 KB" : formatBytes(storageUsed)} limitText={formatBytes(storageLimit)} />
              </ul>
              <p className="mt-4 text-xs text-muted">As mensagens recomeçam todo dia à meia-noite. Quer mais espaço? É só mudar de plano, logo abaixo.</p>
            </Card>
          </section>
        </>
      )}

      {selling.length > 0 && (
        <section aria-labelledby="mudar" className="flex flex-col gap-3">
          <h2 id="mudar" className="text-label text-muted">{paid ? "Mudar de plano" : "Escolha um plano"}</h2>
          <ul className={cn("grid grid-cols-1 gap-4", selling.length > 1 && "sm:grid-cols-2", selling.length > 2 && "lg:grid-cols-3")}>
            {selling.map((p) => {
              const current = paid && p.id === settings.plan;
              const saving = planSaving(p, plans);
              const up = paid && !current && isUpgrade(plan, p);
              return (
                <li key={p.id}>
                  <Card className={cn("flex h-full flex-col gap-3 p-5", current ? "border-accent" : p.featured && "border-accent/60")}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-text">{p.name}</h3>
                      {current ? <span className="rounded-full border border-accent px-2 py-0.5 text-xs font-semibold text-accent">Seu plano</span>
                        : saving !== null && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">economize {Math.round(saving * 100)}%</span>}
                    </div>
                    <p><span className="font-mono text-3xl font-semibold text-text">{formatMoney(p.priceCents)}</span> <span className="text-sm text-muted">{planPeriod(p)}</span></p>
                    {p.months > 1 && <p className="text-xs text-muted">equivale a {formatMoney(perMonthCents(p))} por mês</p>}
                    {p.tagline && <p className="text-xs text-muted">{p.tagline}</p>}
                    <Limits plan={p} />
                    {!current && (
                      <form action={startCheckout.bind(null, p.id)} className="mt-auto pt-1">
                        <button type="submit" aria-label={`${up ? "Fazer upgrade" : paid ? "Trocar para este" : checkoutLabel(p)} (plano ${p.name.toLowerCase()})`}
                          className={cn("inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold", up || !paid ? "bg-accent text-on-accent hover:opacity-90" : "border border-border text-text hover:bg-surface-2")}>
                          {up ? "Fazer upgrade" : paid ? "Trocar para este" : checkoutLabel(p)}
                        </button>
                      </form>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
          {paid && <p className="text-xs text-muted">Ao contratar outro plano, o atual é encerrado quando o pagamento confirma e o novo vale a partir daquele dia. O que já foi pago do plano anterior não é devolvido proporcionalmente. Dúvida? <Link href="/ajustes/suporte" className="underline">Fale com uma pessoa</Link>.</p>}
        </section>
      )}

      {billing?.renews && (
        <form action={cancelPlan} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-body">Cancelar é imediato: para de cobrar e o acesso continua até {end ? longDay(end) : "o fim do período"}.</span>
          <button type="submit" className="h-8 rounded-md border border-border px-3 text-sm font-medium text-text hover:bg-surface-2">Cancelar assinatura</button>
        </form>
      )}
    </div>
  );
}
