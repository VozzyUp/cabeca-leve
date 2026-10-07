import { ArrowDownRight, ArrowUpRight, CreditCard, Landmark, Layers, Repeat, Wallet } from "lucide-react";
import Link from "next/link";
import { setRecurrenceActive } from "@/app/actions";
import { ColumnChart, PairedColumnChart } from "@/components/charts/columns";
import { ActionSwitch } from "@/components/ui/action-controls";
import { Card, SectionLabel } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState, Metric, Progress } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/load-error";
import { FinanceNav } from "@/components/screens/finance-nav";
import type { Recurrence } from "@/lib/data/types";
import {
  cardStatus, categoryTrends, installmentForecast, installmentStatus, monthlyTotals, recurringSummary, variableSpending,
} from "@/lib/domain/money";
import { serverContext } from "@/lib/server";
import { capitalizeFirst, formatDayLabel, formatMoney, formatMonth, formatShortDate } from "@/lib/time";

const pct = (x: number) => `${Math.round(x * 100)}%`;

function FinanceHeader({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader id={id} title={title}>{children}</PageHeader>
      <FinanceNav />
    </div>
  );
}

// Variação contra uma referência, com seta e texto ("12% acima")
function Change({ value, invert = false }: { value: number; invert?: boolean }) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return <span className="text-muted">igual</span>;
  const up = value > 0;
  const bad = invert ? !up : up;   // gasto subindo é ruim
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5", bad ? "text-expense" : "text-income")}>
      <Icon aria-hidden className="size-3.5" />{pct(Math.abs(value))} {up ? "acima" : "abaixo"}
    </span>
  );
}

// ---- S19 ----
export async function VariableScreen() {
  const { store, today, now, tz } = await serverContext();
  const [transactions, categories] = await Promise.all([store.listTransactions(), store.listCategories()]);
  const month = today.slice(0, 7);
  const s = variableSpending(transactions, categories, month, today);
  const vsPrev = s.previousMonthCents ? (s.totalCents - s.previousMonthCents) / s.previousMonthCents : NaN;
  const latest = transactions.filter((t) => t.type === "expense" && !t.recurrenceId && t.occurredOn.startsWith(month)).slice(0, 8);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return (
    <div className="flex flex-col gap-6">
      <FinanceHeader id="S19" title="Gastos do dia a dia" />
      {s.totalCents === 0 ? (
        <EmptyState icon={<Wallet className="size-8" />} title="Nenhum gasto do dia a dia neste mês"
          text='Conte na conversa, do seu jeito: "gastei 32 no almoço". Contas fixas ficam na página Fixos.' />
      ) : (
        <>
          <Card className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={`Gasto em ${formatMonth(month, "short").replace(".", "")}`} value={formatMoney(s.totalCents)} tone="expense"
              hint="sem contas fixas e assinaturas" />
            <Metric label="Média por dia" value={formatMoney(s.dailyAverageCents)} />
            <Metric label="No ritmo atual" value={formatMoney(s.projectedCents)} hint="até o fim do mês" />
            <div className="flex flex-col gap-1">
              <p className="text-label text-muted">Mês passado</p>
              <p className="text-metric text-text">{formatMoney(s.previousMonthCents)}</p>
              <p className="text-xs text-muted">mesmo período · <Change value={vsPrev} /></p>
            </div>
          </Card>
          <Card>
            <SectionLabel className="mb-4">Gasto por dia</SectionLabel>
            <ColumnChart caption={`Gasto do dia a dia por dia em ${formatMonth(month)}`} labelEvery={5}
              columns={s.days.map((d) => ({ key: d.day, label: String(Number(d.day.slice(8))), value: d.cents, display: formatMoney(d.cents) }))} />
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionLabel className="mb-2">Por categoria</SectionLabel>
              <table className="w-full text-sm">
                <caption className="sr-only">Gastos do dia a dia por categoria</caption>
                <thead><tr className="text-xs text-muted"><th scope="col" className="py-1 text-left font-medium">Categoria</th><th scope="col" className="py-1 text-right font-medium">Vezes</th><th scope="col" className="py-1 text-right font-medium">Total</th></tr></thead>
                <tbody>
                  {s.byCategory.map((c) => (
                    <tr key={c.name} className="border-t border-border">
                      <th scope="row" className="py-2 text-left font-normal text-body">{c.name}</th>
                      <td className="py-2 text-right font-mono text-muted">{c.count}</td>
                      <td className="py-2 text-right font-mono text-text">{formatMoney(c.cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card>
              <SectionLabel className="mb-2">Últimos gastos</SectionLabel>
              <ul className="flex flex-col divide-y divide-border">
                {latest.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-text">{t.description}</span>
                      <span className="text-xs text-muted">{capitalizeFirst(formatDayLabel(t.occurredOn, now, tz))} · {names.get(t.categoryId ?? "") ?? "Sem categoria"}</span>
                    </span>
                    <span className="font-mono text-expense">−{formatMoney(t.amountCents)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/dinheiro/extrato" className="mt-2 inline-block text-sm font-medium text-info hover:underline">Ver o extrato completo</Link>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ---- S20 ----
const KIND_LABEL: Record<Recurrence["kind"], string> = { income: "Entradas", bill: "Contas", subscription: "Assinaturas" };

export async function RecurringScreen() {
  const { store, today, now, tz } = await serverContext();
  const [recurrences, transactions] = await Promise.all([store.listRecurrences(), store.listTransactions()]);
  const s = recurringSummary(recurrences, transactions, today);
  return (
    <div className="flex flex-col gap-6">
      <FinanceHeader id="S20" title="Fixos" />
      {s.items.length === 0 ? (
        <EmptyState icon={<Repeat className="size-8" />} title="Nenhum fixo cadastrado"
          text='Diga na conversa: "aluguel de 1.800 todo dia 5" ou "recebo o salário dia 1".' />
      ) : (
        <>
          <Card className="grid gap-6 sm:grid-cols-3">
            <Metric label="Sai todo mês" value={formatMoney(s.monthlyBillsCents)} tone="expense" hint="contas e assinaturas ativas" />
            <Metric label="Entra todo mês" value={formatMoney(s.monthlyIncomeCents)} tone="income" />
            <div className="flex flex-col gap-2">
              <Metric label="Já comprometido" value={pct(s.committedShare)} hint="da entrada fixa vai para fixos" />
            </div>
          </Card>
          {(["bill", "subscription", "income"] as const).map((kind) => {
            const items = s.items.filter((i) => i.kind === kind);
            if (!items.length) return null;
            return (
              <section key={kind} aria-labelledby={`fixos-${kind}`}>
                <h2 id={`fixos-${kind}`} className="mb-2 text-label text-muted">{KIND_LABEL[kind]}</h2>
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
                  {items.map((r) => (
                    <li key={r.id} className={cn("flex items-center gap-3 px-4 py-3", !r.active && "opacity-60")}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-text">{r.description}</span>
                        <span className="text-xs text-muted">
                          todo dia {r.dayOfMonth} ·{" "}
                          {!r.active ? "pausado"
                            : r.nextOn.slice(0, 7) === today.slice(0, 7) ? `${kind === "income" ? "entra" : "vence"} ${formatDayLabel(r.nextOn, now, tz)}`
                            : r.paidThisMonth ? `${kind === "income" ? "recebido" : "pago"} este mês · próximo ${formatShortDate(r.nextOn)}`
                            : <span className="text-warning">dia {r.dayOfMonth} passou sem {kind === "income" ? "entrada" : "pagamento"} registrado</span>}
                        </span>
                      </span>
                      <span className={cn("font-mono text-sm", kind === "income" ? "text-income" : "text-text")}>{formatMoney(r.amountCents)}</span>
                      <ActionSwitch checked={r.active} label={`${r.description} ativo`} action={setRecurrenceActive.bind(null, r.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

// ---- S21 ----
export async function InstallmentsScreen() {
  const { store, today } = await serverContext();
  const [purchases, cards] = await Promise.all([store.listInstallments(), store.listCards()]);
  const items = purchases.map((p) => installmentStatus(p, today));
  const open = items.filter((i) => !i.finished);
  const done = items.filter((i) => i.finished);
  const forecast = installmentForecast(purchases, today, 6);
  const cardName = new Map(cards.map((c) => [c.id, c.name]));
  return (
    <div className="flex flex-col gap-6">
      <FinanceHeader id="S21" title="Parcelas" />
      {items.length === 0 ? (
        <EmptyState icon={<Layers className="size-8" />} title="Nenhuma compra parcelada"
          text='Conte na conversa: "comprei uma geladeira de 3.000 em 10x no cartão".' />
      ) : (
        <>
          <Card className="grid gap-6 sm:grid-cols-3">
            <Metric label="Parcelas deste mês" value={formatMoney(forecast[0].cents)} tone="expense" />
            <Metric label="Ainda a pagar" value={formatMoney(open.reduce((s, i) => s + i.remainingCents, 0))} hint={`${open.length} compras em aberto`} />
            <Metric label="Livre de parcelas em" value={open.length ? capitalizeFirst(formatMonth(open.reduce((m, i) => (i.lastMonth > m ? i.lastMonth : m), "")).replace(" de ", "/")) : "já"} />
          </Card>
          <Card>
            <SectionLabel className="mb-4">Próximos 6 meses</SectionLabel>
            <ColumnChart caption="Total de parcelas por mês nos próximos 6 meses"
              columns={forecast.map((f) => ({ key: f.month, label: formatMonth(f.month, "short").replace(".", ""), value: f.cents, display: formatMoney(f.cents) }))} />
          </Card>
          <section aria-labelledby="parcelas-abertas" className="flex flex-col gap-2">
            <h2 id="parcelas-abertas" className="text-label text-muted">Em aberto</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {open.map((i) => (
                <li key={i.id}>
                  <Card className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex flex-col">
                        <span className="font-medium text-text">{i.description}</span>
                        <span className="text-xs text-muted">{i.cardId ? cardName.get(i.cardId) : "Sem cartão"} · total {formatMoney(i.totalCents)}</span>
                      </span>
                      <span className="text-right font-mono text-sm text-text">{formatMoney(i.monthlyCents)}<span className="block text-xs text-muted">por mês</span></span>
                    </div>
                    <Progress label={`Parcela ${i.paid} de ${i.count}`} value={i.paid} max={i.count} display={`faltam ${formatMoney(i.remainingCents)}`} />
                    <p className="text-xs text-muted">Última parcela em {formatMonth(i.lastMonth)}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
          {done.length > 0 && (
            <section aria-labelledby="parcelas-quitadas">
              <h2 id="parcelas-quitadas" className="mb-2 text-label text-muted">Quitadas</h2>
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
                {done.map((i) => (
                  <li key={i.id} className="flex justify-between px-4 py-3 text-sm"><span className="text-body">{i.description}</span><span className="font-mono text-muted">{formatMoney(i.totalCents)}</span></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ---- S22 ----
export async function AccountsScreen() {
  const { store, today } = await serverContext();
  const [accounts, cards, transactions, purchases] = await Promise.all([store.listAccounts(), store.listCards(), store.listTransactions(), store.listInstallments()]);
  const statuses = cards.map((c) => cardStatus(c, transactions, purchases, today));
  return (
    <div className="flex flex-col gap-6">
      <FinanceHeader id="S22" title="Contas e cartões" />
      <Card className="grid gap-6 sm:grid-cols-2">
        <Metric label="Saldo somado" value={formatMoney(accounts.reduce((s, a) => s + a.balanceCents, 0))} hint={`${accounts.length} conta${accounts.length === 1 ? "" : "s"}`} />
        <Metric label="Faturas abertas" value={formatMoney(statuses.reduce((s, c) => s + c.invoiceCents, 0))} tone="expense" hint={`${cards.length} cartão${cards.length === 1 ? "" : "ões"}`} />
      </Card>
      <section aria-labelledby="contas" className="flex flex-col gap-2">
        <h2 id="contas" className="text-label text-muted">Contas</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {accounts.map((a) => (
            <li key={a.id}>
              <Card className="flex items-center gap-3">
                <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-body"><Landmark className="size-5" /></span>
                <span className="flex flex-1 flex-col"><span className="font-medium text-text">{a.name}</span><span className="text-xs text-muted">saldo de hoje</span></span>
                <span className={cn("font-mono", a.balanceCents < 0 ? "text-expense" : "text-text")}>{formatMoney(a.balanceCents)}</span>
              </Card>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="cartoes" className="flex flex-col gap-2">
        <h2 id="cartoes" className="text-label text-muted">Cartões de crédito</h2>
        {statuses.length === 0 ? (
          <EmptyState icon={<CreditCard className="size-8" />} title="Nenhum cartão"
            text='Diga na conversa: "meu cartão fecha dia 3 e vence dia 10, limite de 5 mil".' />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {statuses.map((c) => (
              <li key={c.id}>
                <Card className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-body"><CreditCard className="size-5" /></span>
                    <span className="flex flex-1 flex-col"><span className="font-medium text-text">{c.name}</span>
                      <span className="text-xs text-muted">fecha dia {c.closingDay} · vence dia {c.dueDay}</span></span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Metric label="Fatura aberta" value={formatMoney(c.invoiceCents)} tone="expense" hint={`fecha ${formatShortDate(c.closesOn)}, vence ${formatShortDate(c.dueOn)}`} />
                    <Metric label="Disponível" value={formatMoney(Math.max(0, c.availableCents))} hint={`de ${formatMoney(c.limitCents)}`} />
                  </div>
                  <Progress label="Limite usado (fatura + parcelas futuras)" value={c.usedCents} max={c.limitCents} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-muted">Os saldos são calculados com o que você conta na conversa. A conexão direta com o banco fica para depois do lançamento.</p>
    </div>
  );
}

// ---- S23 ----
export async function AnalysisScreen() {
  const { store, today } = await serverContext();
  const [transactions, categories] = await Promise.all([store.listTransactions(), store.listCategories()]);
  const months = monthlyTotals(transactions, today, 6);
  const closed = months.slice(0, -1).filter((m) => m.incomeCents || m.expenseCents);
  const trends = categoryTrends(transactions, categories, today, 5).slice(0, 8);
  const avgIncome = closed.length ? closed.reduce((s, m) => s + m.incomeCents, 0) / closed.length : 0;
  const avgExpense = closed.length ? closed.reduce((s, m) => s + m.expenseCents, 0) / closed.length : 0;
  const saving = avgIncome ? (avgIncome - avgExpense) / avgIncome : 0;
  const biggestRise = [...trends].filter((t) => t.averageCents >= 5000).sort((a, b) => b.change - a.change)[0];
  const label = (m: string) => capitalizeFirst(formatMonth(m, "short").replace(".", ""));
  return (
    <div className="flex flex-col gap-6">
      <FinanceHeader id="S23" title="Análise" />
      {closed.length < 2 ? (
        <EmptyState icon={<Wallet className="size-8" />} title="Ainda é cedo para comparar"
          text="Com dois meses de lançamentos, esta página mostra a sua média, o que subiu e o que caiu." />
      ) : (
        <>
          <Card className="grid gap-6 sm:grid-cols-3">
            <Metric label="Entrada média" value={formatMoney(Math.round(avgIncome))} tone="income" hint={`últimos ${closed.length} meses fechados`} />
            <Metric label="Gasto médio" value={formatMoney(Math.round(avgExpense))} tone="expense" />
            <Metric label="Guardou em média" value={pct(saving)} hint="da entrada, por mês" />
          </Card>
          {biggestRise && biggestRise.change > 0.1 && (
            <Card className="text-sm text-body">
              <strong className="text-text">{biggestRise.name}</strong> foi {pct(biggestRise.change)} acima da média no mês passado
              ({formatMoney(biggestRise.lastMonthCents)} contra {formatMoney(biggestRise.averageCents)}).
            </Card>
          )}
          <Card>
            <SectionLabel className="mb-4">Entrou e saiu, mês a mês</SectionLabel>
            <PairedColumnChart caption="Entradas e gastos dos últimos 6 meses"
              series={[{ name: "Entrou", className: "bg-income" }, { name: "Saiu", className: "bg-expense" }]}
              groups={months.map((m) => ({ key: m.month, label: label(m.month), values: [m.incomeCents, m.expenseCents], displays: [formatMoney(m.incomeCents), formatMoney(m.expenseCents)] }))} />
          </Card>
          <Card>
            <SectionLabel className="mb-2">Categorias: mês passado contra a média</SectionLabel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <caption className="sr-only">Gasto por categoria no mês passado comparado à média dos 5 meses fechados</caption>
                <thead><tr className="text-xs text-muted">
                  <th scope="col" className="py-1 text-left font-medium">Categoria</th>
                  <th scope="col" className="py-1 text-right font-medium">Média</th>
                  <th scope="col" className="py-1 text-right font-medium">Mês passado</th>
                  <th scope="col" className="py-1 text-right font-medium">Diferença</th>
                </tr></thead>
                <tbody>
                  {trends.map((t) => (
                    <tr key={t.name} className="border-t border-border">
                      <th scope="row" className="py-2 text-left font-normal text-body">{t.name}</th>
                      <td className="py-2 text-right font-mono text-muted">{formatMoney(t.averageCents)}</td>
                      <td className="py-2 text-right font-mono text-text">{formatMoney(t.lastMonthCents)}</td>
                      <td className="py-2 text-right text-xs"><Change value={t.change} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
