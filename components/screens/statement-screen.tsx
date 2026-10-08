"use client";
import { Receipt, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Metric } from "@/components/ui/data";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import { capitalizeFirst, formatDayLabel, formatMoney, formatMonth } from "@/lib/time";
import { FinanceNav } from "./finance-nav";

type Data = Awaited<ReturnType<typeof api.transactions>>;

const METHOD: Record<string, string> = { pix: "Pix", debit: "débito", credit: "crédito", cash: "dinheiro", other: "" };

// S24: extrato com busca, agrupado por dia
export function StatementScreen() {
  const { data, error, reload: load } = useResource<Data>(api.transactions);
  const [query, setQuery] = useState("");
  const [days, setDays] = useState(20);  // dias mostrados; o resto vem em "Mostrar mais"
  const [type, setType] = useState<"all" | "expense" | "income">("all");
  const [month, setMonth] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [method, setMethod] = useState("");
  const filtering = type !== "all" || !!month || !!categoryId || !!method;

  const catName = useMemo(() => new Map(data?.categories.map((c) => [c.id, c.name])), [data]);
  // categoria escolhida inclui as subcategorias dela
  const categorySet = useMemo(() => {
    if (!categoryId) return null;
    return new Set([categoryId, ...(data?.categories.filter((c) => c.parentId === categoryId).map((c) => c.id) ?? [])]);
  }, [categoryId, data]);
  const months = useMemo(() => [...new Set((data?.transactions ?? []).map((t) => t.occurredOn.slice(0, 7)))].sort().reverse(), [data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return (data?.transactions ?? []).filter((t) => (!q
      || t.description.toLocaleLowerCase("pt-BR").includes(q)
      || (catName.get(t.categoryId ?? "") ?? "").toLocaleLowerCase("pt-BR").includes(q))
      && (type === "all" || t.type === type)
      && (!month || t.occurredOn.startsWith(month))
      && (!categorySet || categorySet.has(t.categoryId ?? ""))
      && (!method || (t.paymentMethod ?? "none") === method));
  }, [data, query, catName, type, month, categorySet, method]);
  const filteredIn = filtered.filter((t) => t.type === "income").reduce((a, t) => a + t.amountCents, 0);
  const filteredOut = filtered.filter((t) => t.type === "expense").reduce((a, t) => a + t.amountCents, 0);
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

      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros">
        <Segmented label="Tipo" value={type} onChange={setType} options={[{ value: "all", label: "Tudo" }, { value: "expense", label: "Saiu" }, { value: "income", label: "Entrou" }]} />
        <FilterSelect id="f-mes" label="Mês" value={month} onChange={setMonth}
          options={months.map((m) => ({ value: m, label: capitalizeFirst(formatMonth(m)) }))} />
        <FilterSelect id="f-cat" label="Categoria" value={categoryId} onChange={setCategoryId}
          options={(data?.categories ?? []).filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
            .flatMap((c) => [{ value: c.id, label: c.name }, ...(data?.categories ?? []).filter((x) => x.parentId === c.id).map((x) => ({ value: x.id, label: `  ${c.name} › ${x.name}` }))])} />
        <FilterSelect id="f-forma" label="Forma" value={method} onChange={setMethod}
          options={[["pix", "Pix"], ["debit", "Débito"], ["credit", "Crédito"], ["cash", "Dinheiro"], ["other", "Outra"], ["none", "Não informada"]].map(([value, label]) => ({ value, label }))} />
        {filtering && <Button size="sm" variant="ghost" onClick={() => { setType("all"); setMonth(""); setCategoryId(""); setMethod(""); }}>Limpar filtros</Button>}
      </div>
      {data && (filtering || query) && filtered.length > 0 && (
        <p role="status" className="text-sm text-body">
          {filtered.length} lançamento{filtered.length === 1 ? "" : "s"}
          {filteredOut > 0 && <> · saiu <span className="font-mono text-expense">{formatMoney(filteredOut)}</span></>}
          {filteredIn > 0 && <> · entrou <span className="font-mono text-income">{formatMoney(filteredIn)}</span></>}
        </p>
      )}

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
          action={<Link href="/conversa" className="text-sm font-medium text-accent hover:underline">Abrir a conversa</Link>} />
      )}
      {data && data.transactions.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted">{query ? `Nada encontrado para “${query}”` : "Nenhum lançamento"}{filtering ? " com esses filtros" : ""}.</p>
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

function FilterSelect({ id, label, value, onChange, options }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-9 max-w-48 rounded-md border border-border-input bg-bg px-2 text-sm text-text">
        <option value="">Todos</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
