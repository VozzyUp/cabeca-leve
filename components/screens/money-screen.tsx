"use client";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { confirmBillAction } from "@/app/actions";
import { ActionButton } from "@/components/ui/action-controls";
import { Card, SectionLabel } from "@/components/ui/card";
import type { ToResolve } from "@/lib/domain/resolve";
import { EmptyState, Metric } from "@/components/ui/data";
import { IconButton } from "@/components/ui/button";
import { LoadError, PageHeader } from "@/components/ui/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import { BudgetsCard } from "./budgets-card";
import { FinanceNav } from "./finance-nav";
import { capitalizeFirst, formatMoney, formatShortDate } from "@/lib/time";

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
const monthName = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return capitalizeFirst(new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1))));
};

// S18: o mês num olhar
export function MoneyScreen() {
  const [month, setMonth] = useState<string | undefined>(undefined);
  const fetcher = useCallback(() => api.financeSummary(month), [month]);
  const { data, error, reload } = useResource(fetcher);
  const current = data?.month ?? month;
  const isThisMonth = data ? data.month === data.today.slice(0, 7) : true;
  const max = Math.max(1, ...(data?.byCategory.map((c) => c.cents) ?? [1]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S18" title="Dinheiro">
        {current && (
          <div className="flex items-center gap-1">
            <IconButton label="Mês anterior" onClick={() => setMonth(shiftMonth(current, -1))}><ChevronLeft className="size-5" /></IconButton>
            <p aria-live="polite" className="min-w-36 text-center text-sm font-medium">{monthName(current)}</p>
            <IconButton label="Próximo mês" disabled={isThisMonth} onClick={() => setMonth(shiftMonth(current, 1))}><ChevronRight className="size-5" /></IconButton>
          </div>
        )}
      </PageHeader>
      <FinanceNav />

      {error && <LoadError what="carregar o resumo do mês" onRetry={reload} />}
      {!data && !error && <div className="grid gap-3 sm:grid-cols-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}

      {data && (
        <Card className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Entrou" value={formatMoney(data.incomeCents)} tone="income" />
          <Metric label="Saiu" value={formatMoney(data.expenseCents)} tone="expense"
            hint={data.dailyAverageCents ? `média de ${formatMoney(data.dailyAverageCents)} por dia` : undefined} />
          <Metric label="Sobra do mês" value={formatMoney(data.leftoverCents)} hint="entrou menos saiu" />
          <Metric label="Saldo em conta" value={formatMoney(data.balanceCents)} hint="hoje" />
        </Card>
      )}

      {data && isThisMonth && data.toResolve.length > 0 && <ResolveCard items={data.toResolve} onChange={reload} />}

      {data && <BudgetsCard budgets={data.budgets} categories={data.expenseCategories} onChange={reload} />}

      {data && data.byCategory.length === 0 && (
        <EmptyState icon={<Wallet className="size-8" />} title="Nenhum gasto neste mês"
          text="Os gastos que você contar na conversa aparecem aqui, separados por categoria." />
      )}

      {data && data.byCategory.length > 0 && (
        <Card>
          <SectionLabel className="mb-3">Para onde foi o dinheiro</SectionLabel>
          {/* barras de série única: uma cor, sem legenda; a própria tabela é a visão acessível */}
          <table className="w-full border-separate border-spacing-y-1 text-sm">
            <caption className="sr-only">Gastos de {monthName(data.month).toLocaleLowerCase("pt-BR")} por categoria, do maior para o menor</caption>
            <thead className="sr-only"><tr><th scope="col">Categoria</th><th scope="col">Proporção</th><th scope="col">Valor</th></tr></thead>
            <tbody>
              {data.byCategory.map((c) => (
                <tr key={c.name} className="group" title={`${c.name}: ${formatMoney(c.cents)} (${Math.round(c.share * 100)}% dos gastos)`}>
                  <th scope="row" className="w-32 truncate py-1.5 pr-3 text-left font-normal text-body group-hover:text-text sm:w-44">{c.name}</th>
                  <td className="py-1.5" aria-label={`${Math.round(c.share * 100)}%`}>
                    <div className="h-2 rounded-r-[4px] bg-accent transition-opacity group-hover:opacity-80"
                      style={{ width: `${Math.max(2, (c.cents / max) * 100)}%` }} />
                  </td>
                  <td className="w-28 py-1.5 pl-3 text-right font-mono text-text">{formatMoney(c.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/dinheiro/extrato" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">Ver todos os lançamentos</Link>
        </Card>
      )}
    </div>
  );
}

const WHEN = (p: ToResolve) =>
  p.status === "late" ? `venceu em ${formatShortDate(p.dueOn)}, há ${p.days} dia${p.days === 1 ? "" : "s"}`
  : p.status === "today" ? "vence hoje"
  : `vence em ${formatShortDate(p.dueOn)}, daqui a ${p.days} dia${p.days === 1 ? "" : "s"}`;

// A resolver: contas fixas e entradas esperadas que venceram sem lançamento ou vencem em breve
function ResolveCard({ items, onChange }: { items: ToResolve[]; onChange: () => void }) {
  return (
    <Card>
      <SectionLabel className="mb-1">A resolver</SectionLabel>
      <p className="mb-2 text-xs text-muted">Confirme para lançar no extrato, no vencimento, com o valor combinado.</p>
      <ul aria-label="Contas e entradas a resolver" className="flex flex-col divide-y divide-border">
        {items.map((p) => (
          <li key={`${p.recurrenceId}-${p.dueOn}`} className="flex items-center gap-3 py-2.5">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-text">{p.description}</span>
              <span className={p.status === "late" ? "text-xs text-warning" : "text-xs text-muted"}>{WHEN(p)}</span>
            </span>
            <span className={p.kind === "income" ? "font-mono text-sm text-income" : "font-mono text-sm text-text"}>{formatMoney(p.amountCents)}</span>
            <ActionButton variant="secondary" size="sm" aria-label={`${p.kind === "income" ? "Recebi" : "Paguei"}: ${p.description}`}
              action={async () => { await confirmBillAction(p.recurrenceId, p.dueOn); onChange(); }}>
              {p.kind === "income" ? "Recebi" : "Paguei"}
            </ActionButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}
