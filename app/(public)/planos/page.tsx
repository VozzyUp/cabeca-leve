import { Check } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { PLANS, TRIAL_DAYS, yearlySaving } from "@/lib/plans";
import { formatMoney } from "@/lib/time";

const INCLUDED = [
  "Conversa por texto e áudio, no app e no WhatsApp",
  "Tarefas, lembretes, agenda e resumo da manhã",
  "Gastos, contas fixas, parcelas e cartões",
  "Hábitos, metas, notas e diário",
  "Sem limite de mensagens",
];
const FAQ = [
  ["Posso cancelar quando quiser?", "Pode, em Ajustes, com um toque. O acesso continua até o fim do período já pago."],
  ["Preciso instalar alguma coisa?", "Não. Funciona no navegador do celular e do computador, e pelo WhatsApp."],
  ["Meus dados ficam com quem?", "Só com você. Dá para baixar tudo ou excluir a conta a qualquer momento, em Ajustes."],
];

// S32: planos. O checkout (Stripe ou Asaas) entra no /replica-backend; até lá o botão leva ao cadastro.
export default async function Page({ searchParams }: PageProps<"/planos">) {
  const { novo } = await searchParams;
  const plans = [PLANS.monthly, PLANS.yearly];
  return (
    <div className="flex flex-col items-center gap-10">
      <header className="flex max-w-xl flex-col items-center gap-3 text-center">
        <p className="text-label text-muted">S32</p>
        <h1 className="text-3xl font-bold text-text">{novo ? "Conta criada. Escolha o plano" : "Tire a vida da cabeça"}</h1>
        <p className="text-body">Um assistente que organiza tarefas, dinheiro e rotina pela conversa. {TRIAL_DAYS} dias grátis para testar.</p>
      </header>
      <ul className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {plans.map((p) => {
          const yearly = p.id === "yearly";
          return (
            <li key={p.id}>
              <Card className={cn("flex h-full flex-col gap-4 p-6", yearly && "border-accent")}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-text">{p.name}</h2>
                  {yearly && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">economize {Math.round(yearlySaving * 100)}%</span>}
                </div>
                <p><span className="font-mono text-4xl font-semibold text-text">{formatMoney(p.priceCents)}</span> <span className="text-sm text-muted">{p.period}</span></p>
                <p className="text-sm text-muted">{yearly ? `equivale a ${formatMoney(Math.round(p.priceCents / 12))} por mês` : "cobrado todo mês, cancele quando quiser"}</p>
                <Link href={`/entrar?modo=criar&plano=${p.id}`}
                  className={cn("mt-auto inline-flex h-12 items-center justify-center rounded-md text-base font-semibold",
                    yearly ? "bg-accent text-on-accent hover:opacity-90" : "border border-border text-text hover:bg-surface-2")}>
                  Começar {TRIAL_DAYS} dias grátis
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
      <section aria-labelledby="incluido" className="w-full max-w-3xl">
        <h2 id="incluido" className="mb-3 text-label text-muted">Nos dois planos</h2>
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
