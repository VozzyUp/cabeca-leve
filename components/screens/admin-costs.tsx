import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, SectionLabel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/load-error";
import type { Tokens } from "@/lib/assistant/models";
import { isPeriod, parseRate, PERIODS, type ModelTotal, type PeriodId } from "@/lib/ai-costs";
import { loadCosts } from "@/lib/ai-costs-server";
import { loadAppConfig } from "@/lib/app-config";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { isSupportAdmin } from "@/lib/support";

const usd = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 }).format(v);
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const int = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));
const sumTokens = (t: Tokens) => t.input + t.output + t.cacheRead + t.cacheWrite;

function Money({ usdValue, rate, unpriced = false }: { usdValue: number | null; rate: number; unpriced?: boolean }) {
  if (usdValue === null) return <span className="text-muted">sem preço</span>;
  return <>{usd(usdValue)} <span className="text-muted">({brl(usdValue * rate)})</span>{unpriced && <span className="text-muted"> + sem preço</span>}</>;
}

// Custo da IA por usuário e por modelo: só os e-mails em ADMIN_EMAILS entram aqui
export async function AdminCostsScreen({ period: raw }: { period?: string }) {
  const user = isSupabaseConfigured() ? await currentUser() : null;
  if (!user || !isSupportAdmin(user.email)) notFound();
  await loadAppConfig();
  const period: PeriodId = isPeriod(raw) ? raw : "30d";
  const rate = parseRate(process.env.COST_USD_BRL);
  let loaded: Awaited<ReturnType<typeof loadCosts>>["summary"];
  try { loaded = (await loadCosts(period)).summary; }
  catch (error) {
    // o caso comum: o app foi atualizado e a migração do custo (arquivo 21) ainda não rodou no banco
    console.error("custos não carregaram", (error as Error).message);
    return (
      <div className="flex flex-col gap-6">
        <PageHeader id="admin-custos" title="Custo da IA" />
        <p role="alert" className="max-w-prose rounded-lg border border-danger px-4 py-3 text-sm text-text">
          Não deu para ler os custos. Se você acabou de atualizar o app, falta rodar no banco a migração do custo da IA
          (<span className="font-mono">supabase/colar-no-sql-editor/21_custo_da_ia.sql</span>, ou o segredo <span className="font-mono">SUPABASE_DB_URL</span> no GitHub para aplicar sozinha).
        </p>
      </div>
    );
  }
  const s = loaded;
  const perMessage = s.messages ? s.costUsd / s.messages : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="admin-custos" title="Custo da IA" />
      <nav aria-label="Período" className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link key={p.id} href={`/admin/custos?periodo=${p.id}`} aria-current={p.id === period ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm ${p.id === period ? "border-accent bg-surface-3 text-text" : "border-border text-body hover:text-text"}`}>
            {p.label}
          </Link>
        ))}
      </nav>
      <p className="max-w-prose text-sm text-muted">
        Valores calculados com a tabela de preços da Anthropic e os tokens de cada mensagem (somando todas as chamadas, também o cache). Dólar a {brl(rate)}:
        ajuste em Configuração do sistema. A fatura oficial está em console.anthropic.com.
      </p>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Custo no período", <Money key="c" usdValue={s.costUsd} rate={rate} unpriced={s.hasUnpriced} />],
          ["Mensagens respondidas", int(s.messages)],
          ["Custo por mensagem", s.messages ? <Money key="m" usdValue={perMessage} rate={rate} /> : "-"],
          ["Tokens", int(sumTokens(s.tokens))],
        ].map(([label, value]) => (
          <Card key={String(label)} className="flex flex-col gap-1">
            <SectionLabel>{label}</SectionLabel>
            <p className="text-lg font-semibold text-text">{value}</p>
          </Card>
        ))}
      </section>

      {s.messages === 0 ? (
        <Card><p className="text-body">Nenhuma mensagem respondida pela IA neste período.</p></Card>
      ) : (
        <>
          <section aria-labelledby="por-modelo" className="flex flex-col gap-2">
            <h2 id="por-modelo" className="text-label text-muted">Por modelo</h2>
            <Card className="overflow-x-auto p-0">
              <div role="region" aria-label="Tabela de custo por modelo" tabIndex={0}>
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">Custo da IA por modelo no período</caption>
                  <thead><tr className="border-b border-border text-muted">
                    <th scope="col" className="px-4 py-2 font-medium">Modelo</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Mensagens</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Tokens</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Custo</th>
                  </tr></thead>
                  <tbody>
                    {s.byModel.map((m) => (
                      <tr key={m.model} className="border-b border-border last:border-0">
                        <th scope="row" className="px-4 py-2 font-medium text-text">{m.label}</th>
                        <td className="px-4 py-2 text-right tabular-nums">{int(m.messages)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{int(sumTokens(m.tokens))}</td>
                        <td className="px-4 py-2 text-right tabular-nums"><Money usdValue={m.costUsd} rate={rate} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <section aria-labelledby="por-usuario" className="flex flex-col gap-2">
            <h2 id="por-usuario" className="text-label text-muted">Por usuário</h2>
            <Card className="overflow-x-auto p-0">
              <div role="region" aria-label="Tabela de custo por usuário" tabIndex={0}>
                <table className="w-full min-w-[820px] text-left text-sm">
                  <caption className="sr-only">Custo da IA por usuário no período, com o detalhe por modelo</caption>
                  <thead><tr className="border-b border-border text-muted">
                    <th scope="col" className="px-4 py-2 font-medium">Usuário</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Mensagens</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Tokens</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Custo</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Por mensagem</th>
                    <th scope="col" className="px-4 py-2 font-medium">Por modelo</th>
                  </tr></thead>
                  <tbody>
                    {s.byUser.map((u) => (
                      <tr key={u.userId} className="border-b border-border align-top last:border-0">
                        <th scope="row" className="px-4 py-2 font-medium text-text">
                          {u.name}
                          {u.email && u.email !== u.name && <span className="block text-xs font-normal text-muted">{u.email}</span>}
                        </th>
                        <td className="px-4 py-2 text-right tabular-nums">{int(u.messages)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{int(sumTokens(u.tokens))}</td>
                        <td className="px-4 py-2 text-right tabular-nums"><Money usdValue={u.costUsd} rate={rate} unpriced={u.hasUnpriced} /></td>
                        <td className="px-4 py-2 text-right tabular-nums">{u.messages ? <Money usdValue={u.costUsd / u.messages} rate={rate} /> : "-"}</td>
                        <td className="px-4 py-2">
                          <ul className="flex flex-col gap-0.5 text-xs">
                            {u.models.map((m: ModelTotal) => (
                              <li key={m.model}>{m.label}: {int(m.messages)} msg · <Money usdValue={m.costUsd} rate={rate} /></li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
