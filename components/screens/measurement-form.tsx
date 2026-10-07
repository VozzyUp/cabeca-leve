"use client";
import { useState, useTransition } from "react";
import { addMeasurement } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const num = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : null);

// Registrar peso e medidas do dia (S17)
export function MeasurementForm({ today }: { today: string }) {
  const [v, setV] = useState({ weight: "", waist: "", hip: "" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { day: today, weightKg: num(v.weight), waistCm: num(v.waist), hipCm: num(v.hip) };
    const values = [input.weightKg, input.waistCm, input.hipCm];
    if (values.every((x) => x === null)) { setError("Preencha pelo menos uma medida."); return; }
    if (values.some((x) => x !== null && !Number.isFinite(x))) { setError("Use só números, como 72,5."); return; }
    setError(null);
    start(async () => {
      try { await addMeasurement(input); setV({ weight: "", waist: "", hip: "" }); setSaved(true); }
      catch { setError("Não deu para salvar. Confira os valores e tente de novo."); }
    });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Peso (kg)" inputMode="decimal" value={v.weight} onChange={(e) => { setSaved(false); setV({ ...v, weight: e.target.value }); }} />
        <Field label="Cintura (cm)" inputMode="decimal" value={v.waist} onChange={(e) => { setSaved(false); setV({ ...v, waist: e.target.value }); }} />
        <Field label="Quadril (cm)" inputMode="decimal" value={v.hip} onChange={(e) => { setSaved(false); setV({ ...v, hip: e.target.value }); }} />
      </div>
      <div className="flex items-center justify-between gap-3">
        {error ? <p role="alert" className="text-xs text-danger">{error}</p> : saved ? <p role="status" className="text-xs text-success">Medida de hoje salva.</p> : <span />}
        <Button type="submit" variant="secondary" loading={pending}>Salvar medida de hoje</Button>
      </div>
    </form>
  );
}
