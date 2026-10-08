import { toRRule } from "@/lib/domain/recurrence";

const LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// Opções de repetição a partir do dia escolhido (o dia da semana e do mês vêm dele)
export function repeatOptions(baseDay: string | null) {
  const opts = [
    { value: "", label: "Não repete" },
    { value: toRRule({ freq: "daily", interval: 1 }), label: "Todo dia" },
    { value: toRRule({ freq: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5] }), label: "Dias úteis (seg a sex)" },
  ];
  if (baseDay) {
    const d = new Date(`${baseDay}T12:00:00Z`);
    opts.push(
      { value: toRRule({ freq: "weekly", interval: 1, weekdays: [d.getUTCDay()] }), label: `Toda ${LONG[d.getUTCDay()]}` },
      { value: toRRule({ freq: "monthly", interval: 1, monthDay: d.getUTCDate() }), label: `Todo mês no dia ${d.getUTCDate()}` },
    );
  }
  return opts;
}

export function RepeatSelect({ id, value, onChange, baseDay }: { id: string; value: string; onChange: (v: string) => void; baseDay: string | null }) {
  const opts = repeatOptions(baseDay);
  // regra que não está entre as opções (criada pela conversa): mostra mesmo assim
  if (value && !opts.some((o) => o.value === value)) opts.push({ value, label: "Repetição personalizada" });
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-body">Repetir</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-md border border-border-input bg-bg px-3 text-sm text-text">
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
