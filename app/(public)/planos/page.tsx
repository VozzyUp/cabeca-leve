import { Check } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { WHATSAPP_PROMISE } from "@/lib/whatsapp/promise";
import { checkoutLabel, forSale, perMonthCents, planPeriod, planSaving, storageText, TRIAL_DAYS, waText } from "@/lib/plans";
import { loadPlans } from "@/lib/plans-server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/time";

const INCLUDED = [
  "Conversa por texto e áudio, no app e no WhatsApp",
  "Tarefas, lembretes, agenda e resumo da manhã",
  "Gastos, contas fixas, parcelas e cartões",
  "Hábitos, metas, notas e diário",
];
const FAQ = [
  ["Posso cancelar quando quiser?", "Pode, em Configurações, com um toque. Você recebe um comprovante com protocolo, nenhuma cobrança nova é feita e o acesso continua até o fim do período já pago."],
  ["Preciso instalar alguma coisa?", "Não. Funciona no navegador do celular e do computador, e pelo WhatsApp."],
  ["Vocês acessam o meu WhatsApp?", WHATSAPP_PROMISE],
  ["E se eu precisar de ajuda?", "Em Configurações ou na conversa, peça para falar com uma pessoa: o chamado tem protocolo e alguém do time responde em até 1 dia útil."],
  ["Meus dados ficam com quem?", "Só com você. Dá para baixar tudo ou excluir a conta a qualquer momento, em Configurações."],
];

// S32: planos. Quem já entrou vai para a tela de pagamento do app (Pix, boleto ou cartão); quem não, para o cadastro.
const cta = "inline-flex h-12 items-center justify-center rounded-md text-base font-semibold";
const primary = "bg-accent text-on-accent hover:opacity-90";
const secondary = "border border-border text-text hover:bg-surface-2";

export default async function Page({ searchParams }: PageProps<"/planos">) {
  const { novo, plano, expirou, indisponivel } = await searchParams;
  const loggedIn = isSupabaseConfigured() && !!(await currentUser());
  const chosen = typeof plano === "string" ? plano : null;
  const all = await loadPlans();
  const plans = forSale(all);
  return (
    <div className="flex flex-col items-center gap-10">
      <header className="flex max-w-xl flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold text-text">{novo ? "Conta criada. Escolha o plano" : "Tire a vida da cabeça"}</h1>
        <p className="text-body">Um assistente que organiza tarefas, dinheiro e rotina pela conversa. {TRIAL_DAYS} dias grátis para testar.</p>
        {expirou && <p role="status" className="text-sm text-warning">A página de pagamento expirou. Escolha o plano de novo.</p>}
        {indisponivel && <p role="status" className="text-sm text-warning">Esse plano saiu da venda. Escolha um da lista.</p>}
        {loggedIn && !novo && <Link href="/ajustes/plano" className="text-sm font-medium text-text underline">Ver o meu plano atual</Link>}
      </header>
      <ul className={cn("grid w-full grid-cols-1 gap-4", plans.length > 1 && "max-w-3xl sm:grid-cols-2", plans.length > 2 && "max-w-5xl lg:grid-cols-3", plans.length <= 1 && "max-w-md")}>
        {plans.map((p) => {
          const saving = planSaving(p, all);
          return (
            <li key={p.id}>
              <Card className={cn("flex h-full flex-col gap-4 p-6", p.featured && "border-accent")}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-text">{p.name}</h2>
                  {saving !== null && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">economize {Math.round(saving * 100)}%</span>}
                </div>
                <p><span className="font-mono text-4xl font-semibold text-text">{formatMoney(p.priceCents)}</span> <span className="text-sm text-muted">{planPeriod(p)}</span></p>
                <p className="text-sm text-muted">{p.months > 1 ? `equivale a ${formatMoney(perMonthCents(p))} por mês` : p.recurring ? "cobrado todo mês, cancele quando quiser" : "pagamento único, sem renovação automática"}</p>
                <ul className="flex flex-col gap-1.5 text-sm text-body">
                  <li className="flex items-center gap-2"><Check aria-hidden className="size-4 shrink-0 text-success" />{waText(p.whatsappLimit, true)}</li>
                  <li className="flex items-center gap-2"><Check aria-hidden className="size-4 shrink-0 text-success" />{p.messagesPerDay.toLocaleString("pt-BR")} mensagens por dia</li>
                  <li className="flex items-center gap-2"><Check aria-hidden className="size-4 shrink-0 text-success" />{storageText(p.storageMb)} para documentos</li>
                </ul>
                {p.tagline && <p className="text-xs text-muted">{p.tagline}</p>}
                {loggedIn ? (
                  <Link href={`/assinar/${p.id}`} className={cn(cta, "mt-auto w-full", p.featured ? primary : secondary, chosen === p.id && "ring-2 ring-focus")}>
                    {checkoutLabel()}
                  </Link>
                ) : (
                  <Link href={`/entrar?modo=criar&plano=${p.id}`} className={cn(cta, "mt-auto", p.featured ? primary : secondary)}>
                    Começar {TRIAL_DAYS} dias grátis
                  </Link>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      <section aria-labelledby="incluido" className="w-full max-w-3xl">
        <h2 id="incluido" className="mb-3 text-label text-muted">{plans.length === 2 ? "Nos dois planos" : "Em todos os planos"}</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {INCLUDED.map((i) => <li key={i} className="flex items-start gap-2 text-sm text-body"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{i}</li>)}
        </ul>
      </section>
      <section aria-labelledby="duvidas" className="w-full max-w-3xl">
        <h2 id="duvidas" className="mb-3 text-label text-muted">Dúvidas</h2>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-text">{q}</summary>
              <p className="mt-2 text-sm text-body">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
