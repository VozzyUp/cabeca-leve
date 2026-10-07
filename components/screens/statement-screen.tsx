"use client";
import { Receipt, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Metric } from "@/components/ui/data";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import { formatDayLabel, formatMoney } from "@/lib/time";
import { FinanceNav } from "./finance-nav";

type Data = Awaited<ReturnType<typeof api.transactions>>;

const METHOD: Record<string, string> = { pix: "Pix", debit: "débito", credit: "crédito", cash: "dinheiro", other: "" };

// S24: extrato com busca, agrupado por dia
export function StatementScreen() {
  const { data, error, reload: load } = useResource<Data>(api.transactions);
  const [query, setQuery] = useState("");
  const [days, setDays] = useState(20);  // dias mostrados; o resto vem em "Mostrar mais"

  const catName = useMemo(() => new Map(data?.categories.map((c) => [c.id, c.name])), [data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return (data?.transactions ?? []).filter((t) => !q
      || t.description.toLocaleLowerCase("pt-BR").includes(q)
      || (catName.get(t.categoryId ?? "") ?? "").toLocaleLowerCase("pt-BR").includes(q));
  }, [data, query, catName]);
  const byDay = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const t of filtered) m.set(t.occurredOn, [...(m.get(t.occurredOn) ?? []), t]);
    return [...m.entries()];
  }, [filtered]);

  const now = new Date();
  const balance = data?.accounts.reduce((s, a) => s + a.balanceCents, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label text-muted">S24</p>
          <h1 className="text-[28px] font-bold leading-[34px]">Extrato</h1>
        </div>
        {data && <Metric label="Saldo em conta" value={formatMoney(balance)} />}
      </header>
      <FinanceNav />

      <div className="relative max-w-md">
        <label htmlFor="busca" className="sr-only">Buscar no extrato</label>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input id="busca" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por descrição ou categoria"
          className="h-10 w-full rounded-md border border-border-input bg-bg pl-9 pr-3 text-sm text-text placeholder:text-muted" />
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-md border border-danger px-4 py-3 text-sm">
          Não deu para carregar o extrato.
          <Button size="sm" variant="secondary" onClick={load}>Tentar de novo</Button>
        </div>
      )}
      {!data && !error && <div className="flex flex-col gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}

      {data && data.transactions.length === 0 && (
        <EmptyState icon={<Receipt className="size-8" />} title="Nenhum lançamento ainda"
          text="Conte na conversa: “gastei 42 no almoço” ou “recebi o salário”."
          action={<Link href="/conversa" className="text-sm font-medium text-info hover:underline">Abrir a conversa</Link>} />
      )}
      {data && data.transactions.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted">Nada encontrado para “{query}”.</p>
      )}

      {data && byDay.slice(0, days).map(([day, items]) => {
        const total = items.reduce((s, t) => s + (t.type === "income" ? t.amountCents : -t.amountCents), 0);
        return (
          <section key={day} aria-label={formatDayLabel(day, now, data.timezone)}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-label text-muted">{formatDayLabel(day, now, data.timezone)}</h2>
              <span className="font-mono text-xs text-muted">{total >= 0 ? "+" : "−"}{formatMoney(Math.abs(total))}</span>
            </div>
            <Card className="divide-y divide-border p-0">
              {items.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text">{t.description}</p>
                    <p className="text-xs text-muted">
                      {[catName.get(t.categoryId ?? ""), t.paymentMethod ? METHOD[t.paymentMethod] : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className={`shrink-0 font-mono text-sm ${t.type === "income" ? "text-income" : "text-expense"}`}>
                    {t.type === "income" ? "+" : "−"}{formatMoney(t.amountCents)}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        );
      })}
      {data && byDay.length > days && (
        <Button variant="secondary" className="self-center" onClick={() => setDays((d) => d + 20)}>Mostrar mais</Button>
      )}
    </div>
  );
}
