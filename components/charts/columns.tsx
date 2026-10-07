import { cn } from "@/components/ui/cn";

type Column = { key: string; label: string; value: number; display: string; muted?: boolean };

// Colunas finas de série única (gasto por dia, previsão de parcelas). Uma cor, sem legenda;
// o gráfico é decorativo para o leitor de tela e a tabela logo abaixo traz os mesmos números.
export function ColumnChart({ caption, columns, labelEvery = 1, height = 140 }: {
  caption: string; columns: Column[]; labelEvery?: number; height?: number;
}) {
  const max = Math.max(1, ...columns.map((c) => c.value));
  return (
    <figure className="flex flex-col gap-2">
      <div aria-hidden className="flex items-end gap-[3px]" style={{ height }}>
        {columns.map((c) => (
          <div key={c.key} title={`${c.label}: ${c.display}`} className="group flex h-full flex-1 items-end justify-center">
            <div className={cn("w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80", c.muted ? "bg-surface-3" : "bg-accent")}
              style={{ height: `${c.value ? Math.max(2, (c.value / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-[3px] text-[11px] text-muted">
        {columns.map((c, i) => (
          <span key={c.key} className="flex-1 text-center font-mono">{i % labelEvery === 0 ? c.label : ""}</span>
        ))}
      </div>
      <DataTable caption={caption} head={["", "Valor"]} rows={columns.map((c) => [c.label, c.display])} />
    </figure>
  );
}

// Duas séries lado a lado (entrou × saiu por mês), com legenda em texto
export function PairedColumnChart({ caption, groups, series }: {
  caption: string;
  groups: Array<{ key: string; label: string; values: [number, number]; displays: [string, string] }>;
  series: [{ name: string; className: string }, { name: string; className: string }];
}) {
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex gap-4 text-xs text-body">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("size-2.5 rounded-full", s.className)} />{s.name}</span>
        ))}
      </figcaption>
      <div aria-hidden className="flex h-40 items-end gap-4">
        {groups.map((g) => (
          <div key={g.key} className="flex h-full flex-1 items-end justify-center gap-[3px]"
            title={`${g.label}: ${series[0].name} ${g.displays[0]}, ${series[1].name} ${g.displays[1]}`}>
            {g.values.map((v, i) => (
              <div key={i} className={cn("w-full max-w-4 rounded-t-[4px]", series[i].className)}
                style={{ height: `${v ? Math.max(2, (v / max) * 100) : 0}%` }} />
            ))}
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-4 text-[11px] text-muted">
        {groups.map((g) => <span key={g.key} className="flex-1 text-center">{g.label}</span>)}
      </div>
      <DataTable caption={caption} head={["Mês", series[0].name, series[1].name]} rows={groups.map((g) => [g.label, ...g.displays])} />
    </figure>
  );
}

// Visão em tabela de um gráfico, recolhida por padrão
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs font-medium text-info hover:underline">Ver como tabela</summary>
      <table className="mt-2 w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead><tr className="text-xs text-muted">{head.map((h, i) => <th key={i} scope="col" className={cn("py-1 font-medium", i > 0 && "text-right")}>{h || "Período"}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-border">
              {r.map((cell, i) => i === 0
                ? <th key={i} scope="row" className="py-1 font-normal text-body">{cell}</th>
                : <td key={i} className="py-1 text-right font-mono text-text">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
