import { Dumbbell, Flame, Scale, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setMealDone, setWorkoutDone } from "@/app/actions";
import { LineChart } from "@/components/charts/line";
import { ActionCheck } from "@/components/ui/action-controls";
import { Card, SectionLabel } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState, Metric, Progress } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/load-error";
import { SubNav } from "@/components/ui/subnav";
import { describeWeekdays } from "@/lib/assistant/weekdays";
import type { BodyMeasurement, Meal, MealLog, Workout, WorkoutLog } from "@/lib/data/types";
import { habitHistory, habitStats } from "@/lib/domain/habits";
import { serverContext } from "@/lib/server";
import { addDays, capitalizeFirst, formatDayLabel, formatShortDate } from "@/lib/time";
import { HabitMonth } from "./habit-month";
import { MeasurementForm } from "./measurement-form";

const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const WEEKDAY_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const kg = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;

// ---- S13 ----
function monthCells(month: string, scheduled: number[], done: Set<string>, today: string) {
  const first = `${month}-01`;
  const lead = weekdayOf(first);
  const cells = [];
  for (let d = addDays(first, -lead); d.slice(0, 7) <= month && cells.length < 42; d = addDays(d, 1)) {
    cells.push({ day: d, inMonth: d.slice(0, 7) === month, scheduled: scheduled.includes(weekdayOf(d)), done: done.has(d), future: d > today });
  }
  return cells;
}

export async function HabitDetailScreen({ id }: { id: string }) {
  const { store, today } = await serverContext();
  const [habits, logs] = await Promise.all([store.listHabits(), store.listHabitLogs()]);
  const habit = habits.find((h) => h.id === id);
  if (!habit) notFound();
  const stats = habitStats(habit, logs, today);
  const history = habitHistory(habit, logs, today);
  const done = new Set(logs.filter((l) => l.habitId === habit.id).map((l) => l.day));
  const thisMonth = today.slice(0, 7);
  const [y, m] = thisMonth.split("-").map(Number);
  const lastMonth = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const ranked = history.byWeekday.filter((w) => w.rate !== null && w.planned >= 2).sort((a, b) => b.rate! - a.rate!);
  const monthTitle = (mo: string) => capitalizeFirst(new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long" }).format(new Date(`${mo}-15T12:00:00Z`)));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <PageHeader id="S13" title={habit.name} />
        <p className="text-sm text-muted">{capitalizeFirst(describeWeekdays(habit.weekdays))}{habit.time ? ` às ${habit.time}` : ""}</p>
      </div>
      <Card className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Metric label="Sequência" value={`${stats.streak}`} hint={stats.streak === 1 ? "dia" : "dias seguidos"} />
        <Metric label="Recorde" value={`${stats.best}`} hint="maior sequência" />
        <Metric label="Últimos 30 dias" value={history.rate30 === null ? "—" : `${Math.round(history.rate30 * 100)}%`} hint="dos dias planejados" />
        <Metric label="Total" value={`${history.total}`} hint="vezes feito" />
      </Card>
      <Card className="grid gap-8 sm:grid-cols-2">
        <HabitMonth habitId={habit.id} title={monthTitle(lastMonth)} cells={monthCells(lastMonth, habit.weekdays, done, today)} />
        <HabitMonth habitId={habit.id} title={monthTitle(thisMonth)} cells={monthCells(thisMonth, habit.weekdays, done, today)} />
        <p className="text-xs text-muted sm:col-span-2">Toque num dia para marcar ou desmarcar. Dias fora do plano ficam apagados.</p>
      </Card>
      {ranked.length >= 2 && (
        <Card>
          <SectionLabel className="mb-3">Por dia da semana (últimos 90 dias)</SectionLabel>
          <ul className="flex flex-col gap-3">
            {ranked.map((w) => (
              <li key={w.weekday}><Progress label={capitalizeFirst(WEEKDAY_LONG[w.weekday])} value={Math.round(w.rate! * 100)} max={100} /></li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-body">
            Você vai melhor às {WEEKDAY_LONG[ranked[0].weekday]}s{ranked[ranked.length - 1].rate! < ranked[0].rate! ? ` e falha mais às ${WEEKDAY_LONG[ranked[ranked.length - 1].weekday]}s` : ""}.
          </p>
        </Card>
      )}
    </div>
  );
}

// ---- Saúde: navegação ----
function HealthHeader({ id, title }: { id: string; title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader id={id} title={title} />
      <SubNav label="Páginas de saúde" items={[
        { href: "/saude", label: "Hoje" }, { href: "/saude/treino", label: "Treino" },
        { href: "/saude/dieta", label: "Dieta" }, { href: "/saude/progresso", label: "Progresso" },
      ]} />
    </div>
  );
}

function workoutToday(workouts: Workout[], today: string) {
  return workouts.find((w) => w.weekdays.includes(weekdayOf(today))) ?? null;
}
const mealDone = (logs: MealLog[], meal: Meal, day: string) => logs.some((l) => l.mealId === meal.id && l.day === day);
function weightChange(ms: BodyMeasurement[], days: number, today: string) {
  const withWeight = ms.filter((m) => m.weightKg !== null);
  const last = withWeight[withWeight.length - 1];
  const since = addDays(today, -days);
  const base = [...withWeight].reverse().find((m) => m.day <= since) ?? withWeight[0];
  return last && base && last !== base ? { last, delta: last.weightKg! - base.weightKg! } : last ? { last, delta: 0 } : null;
}

// ---- S14 ----
export async function HealthScreen() {
  const { store, today } = await serverContext();
  const [workouts, workoutLogs, meals, mealLogs, measurements] = await Promise.all([
    store.listWorkouts(), store.listWorkoutLogs(), store.listMeals(), store.listMealLogs(), store.listMeasurements()]);
  const w = workoutToday(workouts, today);
  const kcalPlan = meals.reduce((s, m) => s + m.kcal, 0);
  const kcalDone = meals.filter((m) => mealDone(mealLogs, m, today)).reduce((s, m) => s + m.kcal, 0);
  const weight = weightChange(measurements, 30, today);
  const weekStart = addDays(today, -weekdayOf(today));
  const trainedThisWeek = new Set(workoutLogs.filter((l) => l.day >= weekStart).map((l) => l.day)).size;
  const plannedPerWeek = workouts.reduce((s, x) => s + x.weekdays.length, 0);
  return (
    <div className="flex flex-col gap-6">
      <HealthHeader id="S14" title="Saúde" />
      <Card className="grid gap-6 sm:grid-cols-3">
        <Metric label="Treinos na semana" value={`${trainedThisWeek} de ${plannedPerWeek}`} />
        <Metric label="Calorias de hoje" value={`${kcalDone}`} hint={`de ${kcalPlan} kcal do plano`} />
        <Metric label="Peso" value={weight ? kg(weight.last.weightKg!) : "—"}
          hint={weight && weight.delta ? `${weight.delta > 0 ? "+" : "−"}${kg(Math.abs(weight.delta))} em 30 dias` : "registre na página Progresso"} />
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <SectionLabel>Treino de hoje</SectionLabel>
          {w ? (
            <>
              <p className="font-semibold text-text">{w.name}</p>
              <p className="text-sm text-muted">{w.exercises.map((e) => e.name).join(" · ")}</p>
              <div className="-mx-2">
                <ActionCheck title="Treino feito" checked={workoutLogs.some((l) => l.workoutId === w.id && l.day === today)}
                  action={setWorkoutDone.bind(null, w.id, today)} />
              </div>
              <Link href="/saude/treino" className="text-sm font-medium text-accent hover:underline">Ver a ficha</Link>
            </>
          ) : <p className="text-sm text-muted">Dia de descanso. O próximo treino aparece aqui no dia.</p>}
        </Card>
        <Card className="flex flex-col gap-1">
          <SectionLabel className="mb-2">Refeições de hoje</SectionLabel>
          {meals.length === 0 ? <p className="text-sm text-muted">Sem plano alimentar.</p> : (
            <ul className="-mx-2">
              {meals.map((m) => (
                <li key={m.id}><ActionCheck title={m.name} meta={`${m.time} · ${m.kcal} kcal`} checked={mealDone(mealLogs, m, today)} action={setMealDone.bind(null, m.id, today)} /></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---- S15 ----
export async function WorkoutScreen() {
  const { store, today, now, tz } = await serverContext();
  const [workouts, logs] = await Promise.all([store.listWorkouts(), store.listWorkoutLogs()]);
  const last = (w: Workout) => logs.filter((l: WorkoutLog) => l.workoutId === w.id).map((l) => l.day).sort().pop();
  const monthCount = (w: Workout) => logs.filter((l) => l.workoutId === w.id && l.day.startsWith(today.slice(0, 7))).length;
  return (
    <div className="flex flex-col gap-6">
      <HealthHeader id="S15" title="Treino" />
      {workouts.length === 0 ? (
        <EmptyState icon={<Dumbbell className="size-8" />} title="Nenhuma ficha de treino"
          text='Mande a ficha na conversa: "treino A segunda e sexta: supino 4x10 com 40 kg, remada 4x10…".' />
      ) : workouts.map((w) => {
        const lastDay = last(w);
        const doneToday = lastDay === today;
        return (
          <Card key={w.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-text">{w.name}</h2>
                <p className="text-xs text-muted">
                  {capitalizeFirst(describeWeekdays(w.weekdays))} · {monthCount(w)} vez{monthCount(w) === 1 ? "" : "es"} este mês
                  {lastDay ? ` · último: ${formatDayLabel(lastDay, now, tz)}` : ""}
                </p>
              </div>
              <div className="-mx-2 shrink-0">
                <ActionCheck title={doneToday ? "Feito hoje" : "Marcar feito hoje"} checked={doneToday} action={setWorkoutDone.bind(null, w.id, today)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <caption className="sr-only">Exercícios do {w.name}</caption>
                <thead><tr className="text-xs text-muted">
                  <th scope="col" className="py-1 text-left font-medium">Exercício</th>
                  <th scope="col" className="py-1 text-right font-medium">Séries × repetições</th>
                  <th scope="col" className="py-1 text-right font-medium">Carga</th>
                  <th scope="col" className="py-1 text-right font-medium">Recorde</th>
                </tr></thead>
                <tbody>
                  {w.exercises.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <th scope="row" className="py-2 text-left font-normal text-text">{e.name}</th>
                      <td className="py-2 text-right font-mono text-body">{e.sets} × {e.reps}</td>
                      <td className="py-2 text-right font-mono text-text">{e.loadKg !== null ? kg(e.loadKg) : "—"}</td>
                      <td className="py-2 text-right font-mono text-muted">
                        {e.bestKg !== null ? <span className={cn("inline-flex items-center gap-1", e.loadKg === e.bestKg && "text-success")}>
                          {e.loadKg === e.bestKg && <Trophy aria-label="no recorde" className="size-3.5" />}{kg(e.bestKg)}</span> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---- S16 ----
export async function DietScreen() {
  const { store, today } = await serverContext();
  const [meals, logs] = await Promise.all([store.listMeals(), store.listMealLogs()]);
  const plan = meals.reduce((s, m) => s + m.kcal, 0);
  const eaten = meals.filter((m) => mealDone(logs, m, today)).reduce((s, m) => s + m.kcal, 0);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <div className="flex flex-col gap-6">
      <HealthHeader id="S16" title="Dieta" />
      {meals.length === 0 ? (
        <EmptyState icon={<Flame className="size-8" />} title="Sem plano alimentar"
          text='Mande o plano na conversa ou uma foto dele: "café: 2 ovos e pão integral; almoço: arroz, feijão e frango…".' />
      ) : (
        <>
          <Card className="flex flex-col gap-3">
            <Progress label="Calorias de hoje" value={eaten} max={plan} display={`${eaten} de ${plan} kcal`} />
          </Card>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {meals.map((m) => (
              <li key={m.id}>
                <Card className="flex h-full flex-col gap-2">
                  <div className="-mx-2">
                    <ActionCheck title={m.name} meta={`${m.time} · ${m.kcal} kcal`} checked={mealDone(logs, m, today)} action={setMealDone.bind(null, m.id, today)} />
                  </div>
                  <ul className="flex flex-col gap-1 pl-8 text-sm text-body">{m.items.map((i) => <li key={i}>{i}</li>)}</ul>
                </Card>
              </li>
            ))}
          </ul>
          <Card>
            <SectionLabel className="mb-2">Últimos 7 dias</SectionLabel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-center text-sm">
                <caption className="sr-only">Refeições seguidas nos últimos 7 dias</caption>
                <thead><tr className="text-xs text-muted">
                  <th scope="col" className="py-1 text-left font-medium">Refeição</th>
                  {week.map((d) => <th key={d} scope="col" className="py-1 font-medium">{formatShortDate(d).replace(/ de /, "/").replace(".", "")}</th>)}
                </tr></thead>
                <tbody>
                  {meals.map((m) => (
                    <tr key={m.id} className="border-t border-border">
                      <th scope="row" className="py-2 text-left font-normal text-body">{m.name}</th>
                      {week.map((d) => <td key={d} className={cn("relative py-2", mealDone(logs, m, d) ? "text-success" : "text-muted")}>{mealDone(logs, m, d) ? "✓" : "–"}<span className="sr-only">{mealDone(logs, m, d) ? " seguiu" : " não registrou"}</span></td>)}
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

// ---- S17 ----
export async function ProgressScreen() {
  const { store, today } = await serverContext();
  const ms = await store.listMeasurements();
  const weights = ms.filter((m) => m.weightKg !== null);
  const total = weights.length ? Math.round((weights[weights.length - 1].weightKg! - weights[0].weightKg!) * 10) / 10 : 0;
  const withWaist = ms.filter((m) => m.waistCm !== null);
  return (
    <div className="flex flex-col gap-6">
      <HealthHeader id="S17" title="Progresso do corpo" />
      <Card className="flex flex-col gap-4">
        <SectionLabel>Registrar hoje</SectionLabel>
        <MeasurementForm today={today} />
      </Card>
      {weights.length === 0 ? (
        <EmptyState icon={<Scale className="size-8" />} title="Nenhuma medida ainda" text="Registre o peso uma vez por semana, no mesmo horário, para ver a tendência." />
      ) : (
        <>
          <Card className="grid gap-6 sm:grid-cols-3">
            <Metric label="Peso atual" value={kg(weights[weights.length - 1].weightKg!)} hint={formatShortDate(weights[weights.length - 1].day)} />
            <Metric label="Desde o início" value={total === 0 ? "igual" : `${total > 0 ? "+" : "−"}${kg(Math.abs(total))}`}
              hint={`desde ${formatShortDate(weights[0].day)}`} />
            <Metric label="Cintura" value={withWaist.length ? `${withWaist[withWaist.length - 1].waistCm!.toLocaleString("pt-BR")} cm` : "—"}
              hint={withWaist.length > 1 ? `${(withWaist[withWaist.length - 1].waistCm! - withWaist[0].waistCm!).toLocaleString("pt-BR", { signDisplay: "always" })} cm desde ${formatShortDate(withWaist[0].day)}` : undefined} />
          </Card>
          <Card>
            <SectionLabel className="mb-3">Peso</SectionLabel>
            <LineChart caption="Peso ao longo do tempo" unit="kg" points={weights.map((m) => ({ key: m.day, label: formatShortDate(m.day), value: m.weightKg! }))} />
          </Card>
          <Card>
            <SectionLabel className="mb-2">Histórico de medidas</SectionLabel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <caption className="sr-only">Todas as medidas registradas, da mais recente para a mais antiga</caption>
                <thead><tr className="text-xs text-muted">
                  <th scope="col" className="py-1 text-left font-medium">Dia</th><th scope="col" className="py-1 text-right font-medium">Peso</th>
                  <th scope="col" className="py-1 text-right font-medium">Cintura</th><th scope="col" className="py-1 text-right font-medium">Quadril</th>
                </tr></thead>
                <tbody>
                  {[...ms].reverse().map((m) => (
                    <tr key={m.id} className="border-t border-border">
                      <th scope="row" className="py-2 text-left font-normal text-body">{formatShortDate(m.day)}</th>
                      <td className="py-2 text-right font-mono text-text">{m.weightKg !== null ? kg(m.weightKg) : "—"}</td>
                      <td className="py-2 text-right font-mono text-body">{m.waistCm !== null ? `${m.waistCm.toLocaleString("pt-BR")} cm` : "—"}</td>
                      <td className="py-2 text-right font-mono text-body">{m.hipCm !== null ? `${m.hipCm.toLocaleString("pt-BR")} cm` : "—"}</td>
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
