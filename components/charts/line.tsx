import { DataTable } from "./columns";

// Linha de série única (peso ao longo do tempo), com pontos e a tabela equivalente.
// Escala só no intervalo dos dados, com folga, para a variação ficar visível.
export function LineChart({ caption, points, unit }: { caption: string; points: Array<{ key: string; label: string; value: number }>; unit: string }) {
  const W = 600, H = 180, P = 12;
  const values = points.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const pad = Math.max(0.5, (max - min) * 0.15);
  const lo = min - pad, hi = max + pad;
  const x = (i: number) => P + (points.length === 1 ? (W - 2 * P) / 2 : (i / (points.length - 1)) * (W - 2 * P));
  const y = (v: number) => P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P);
  const fmt = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unit}`;
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex justify-between font-mono text-[11px] text-muted" aria-hidden>
        <span>máx. {fmt(max)}</span><span>mín. {fmt(min)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
        <polyline fill="none" stroke="var(--c-accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round"
          points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} />
        {points.map((p, i) => (
          <circle key={p.key} cx={x(i)} cy={y(p.value)} r={3} fill="var(--c-accent)" vectorEffect="non-scaling-stroke"><title>{`${p.label}: ${fmt(p.value)}`}</title></circle>
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-muted" aria-hidden>
        <span>{points[0]?.label}</span><span>{points[points.length - 1]?.label}</span>
      </div>
      <DataTable caption={caption} head={["Dia", "Medida"]} rows={points.map((p) => [p.label, fmt(p.value)])} />
    </figure>
  );
}
