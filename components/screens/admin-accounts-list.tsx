"use client";
import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/data";
import { accountState, brDay, filterAccounts, KIND_LABEL, summarizeAccounts, untilText, type AccountFilter, type AccountRow } from "@/lib/domain/accounts";

export function StateChip({ row, today }: { row: AccountRow; today: string }) {
  const s = accountState(row, today);
  const tone = s.kind === "paid" ? "border-success text-success" : s.kind === "trial" ? "border-border text-text" : s.kind === "expired" ? "border-border text-muted" : "border-warning text-warning";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", tone)}>
      {s.kind === "trial" || s.kind === "expired" ? s.label : `${s.label}${s.kind === "paid" ? "" : ` · ${KIND_LABEL[s.kind].toLowerCase()}`}`}
      {s.manual && " · manual"}
    </span>
  );
}

const FILTERS: Array<[AccountFilter, string]> = [["all", "Todas"], ["attention", "Atenção"], ["paid", "Com plano"], ["trial", "Em teste"], ["expired", "Sem plano"], ["manual", "Manuais"]];

export function AccountsList({ rows, today }: { rows: AccountRow[]; today: string }) {
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [query, setQuery] = useState("");
  const summary = useMemo(() => summarizeAccounts(rows, today), [rows, today]);
  const visible = useMemo(() => filterAccounts(rows, filter, query, today), [rows, filter, query, today]);
  const count: Record<AccountFilter, number> = { all: summary.total, attention: summary.attention, paid: summary.paid, trial: summary.trial, expired: summary.expired, manual: summary.manual };

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumo das contas">
        {([["Contas", summary.total, `${summary.newThisWeek} nova${summary.newThisWeek === 1 ? "" : "s"} na semana`], ["Com plano", summary.paid, `${summary.manual} manual${summary.manual === 1 ? "" : "is"}`],
          ["Em teste", summary.trial, "dentro do teste grátis"], ["Usaram em 30 dias", summary.active30d, `de ${summary.total}`]] as const).map(([label, value, hint]) => (
          <li key={label}><Card className="flex flex-col gap-1 p-4"><span className="text-label text-muted">{label}</span><span className="font-mono text-2xl font-semibold text-text">{value}</span><span className="text-xs text-muted">{hint}</span></Card></li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="busca-contas" className="sr-only">Buscar conta por nome ou e-mail</label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input id="busca-contas" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail"
            className="h-10 w-full rounded-md border border-border-input bg-bg pl-9 pr-3 text-sm text-text placeholder:text-muted" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
          {FILTERS.map(([value, label]) => <Chip key={value} selected={filter === value} onClick={() => setFilter(value)}>{label} ({count[value]})</Chip>)}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<Search className="size-8" />} title="Nenhuma conta" text="Nenhuma conta combina com esse filtro ou essa busca." />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Contas">
          {visible.map((r) => {
            const s = accountState(r, today);
            return (
              <li key={r.userId}>
                <Link href={`/admin/contas/${r.userId}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:bg-surface-2">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-text">{r.name ?? "Sem nome"}</span>
                      <StateChip row={r} today={today} />
                    </span>
                    <span className="truncate text-xs text-muted">{r.email ?? "sem e-mail"}</span>
                    <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                      <span>{s.kind === "trial" || s.kind === "expired" ? "Teste até" : "Plano até"} {brDay(s.until)}{untilText(s.daysLeft) ? ` (${untilText(s.daysLeft)})` : ""}</span>
                      <span>criada em {brDay(r.createdAt)}</span>
                      <span>{r.messages30d} msg em 30 dias</span>
                      <span>{r.whatsapps} WhatsApp</span>
                      {r.documents > 0 && <span>{r.documents} documento{r.documents === 1 ? "" : "s"}</span>}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
