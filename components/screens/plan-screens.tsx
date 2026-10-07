import { CalendarDays, CalendarX, MapPin } from "lucide-react";
import Link from "next/link";
import { setCalendarConnected } from "@/app/actions";
import { ActionSwitch } from "@/components/ui/action-controls";
import { Card, SectionLabel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/load-error";
import { buildBriefing } from "@/lib/domain/briefing";
import { dayItems } from "@/lib/domain/day";
import { variableSpending } from "@/lib/domain/money";
import { serverContext } from "@/lib/server";
import { addDays, capitalizeFirst, formatDayLabel, formatTime, localDate, zonedParts } from "@/lib/time";
import { BriefingSpeak } from "./briefing-speak";
import { CalendarView, type CalendarItem } from "./calendar-view";
import { FocusTimer } from "./focus-timer";

// ---- S04 ----
export async function BriefingScreen() {
  const { store, now, tz, today } = await serverContext();
  const [settings, reminders, tasks, habits, logs, events, recurrences, transactions, categories] = await Promise.all([
    store.getSettings(), store.listReminders(), store.listTasks(), store.listHabits(), store.listHabitLogs(), store.listEvents(),
    store.listRecurrences(), store.listTransactions(), store.listCategories(),
  ]);
  const spending = variableSpending(transactions, categories, today.slice(0, 7), today);
  const b = buildBriefing({
    name: settings.name, hour: zonedParts(now, tz).hour, today, recurrences,
    items: dayItems({ reminders, tasks, habits, logs, events, now, tz }),
    monthSpentCents: spending.totalCents, lastMonthSamePeriodCents: spending.previousMonthCents,
  });
  const spoken = [b.greeting, b.summary, ...b.sections.map((s) => `${s.title}: ${s.lines.join(". ")}.`)].join(" ");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S04" title="Resumo do dia"><BriefingSpeak text={spoken} /></PageHeader>
      <Card className="flex flex-col gap-2">
        <p className="text-xl font-semibold text-text">{b.greeting}</p>
        <p className="text-body">{b.summary}</p>
      </Card>
      {b.sections.map((s) => (
        <section key={s.title} aria-labelledby={`briefing-${s.title}`} className="flex flex-col gap-2">
          <SectionLabel id={`briefing-${s.title}`}>{s.title}</SectionLabel>
          <ul className="flex flex-col gap-1.5 text-sm text-body">
            {s.lines.map((l) => <li key={l} className="flex gap-2"><span aria-hidden className="text-muted">•</span>{l}</li>)}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted">
        {settings.briefingTime ? `Chega todo dia às ${settings.briefingTime}. ` : ""}
        <Link href="/automacoes" className="font-medium text-info hover:underline">Mudar o horário ou o canal</Link>
      </p>
    </div>
  );
}

// ---- S06 ----
export async function CalendarScreen() {
  const { store, today, tz } = await serverContext();
  const [events, tasks, reminders, recurrences] = await Promise.all([store.listEvents(), store.listTasks(), store.listReminders(), store.listRecurrences()]);
  const items: CalendarItem[] = [
    ...events.map((e) => ({ id: e.id, day: localDate(new Date(e.startsAt), tz), time: formatTime(e.startsAt, tz), title: e.title, source: "agenda" as const, href: "/agenda" })),
    ...tasks.filter((t) => t.dueOn && t.status !== "done").map((t) => ({ id: t.id, day: t.dueOn!, time: null, title: t.title, source: "tarefas" as const, href: "/tarefas" })),
    ...reminders.filter((r) => r.nextFireAt).map((r) => ({ id: r.id, day: localDate(new Date(r.nextFireAt!), tz), time: formatTime(r.nextFireAt!, tz), title: r.title, source: "lembretes" as const, href: "/lembretes" })),
  ];
  // contas fixas: do mês retrasado a três meses à frente
  for (let m = -2; m <= 3; m++) {
    const [y, mo] = today.split("-").map(Number);
    const month = new Date(Date.UTC(y, mo - 1 + m, 1)).toISOString().slice(0, 7);
    const last = new Date(Date.UTC(y, mo + m, 0)).getUTCDate();
    for (const r of recurrences) {
      if (!r.active || r.kind === "income") continue;
      items.push({ id: `${r.id}-${month}`, day: `${month}-${String(Math.min(r.dayOfMonth, last)).padStart(2, "0")}`, time: null,
        title: r.description, source: "contas", href: "/dinheiro/fixos" });
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S06" title="Calendário" />
      <CalendarView items={items} today={today} />
    </div>
  );
}

// ---- S07 ----
export async function FocusScreen({ initialTitle }: { initialTitle: string }) {
  const { store, now, tz, today } = await serverContext();
  const [tasks, sessions] = await Promise.all([store.listTasks(), store.listFocusSessions()]);
  const suggestions = tasks.filter((t) => t.status !== "done" && (!t.dueOn || t.dueOn <= today)).map((t) => t.title);
  const todayMinutes = sessions.filter((s) => s.finishedAt && localDate(new Date(s.startedAt), tz) === today).reduce((m, s) => m + s.minutes, 0);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S07" title="Modo foco">
        <p className="text-sm text-body">Hoje: <span className="font-mono text-text">{todayMinutes} min</span> focados</p>
      </PageHeader>
      <FocusTimer initialTitle={initialTitle} suggestions={suggestions} />
      <section aria-labelledby="foco-historico" className="flex flex-col gap-2">
        <SectionLabel id="foco-historico">Últimas sessões</SectionLabel>
        {sessions.length === 0 ? <p className="text-sm text-muted">As sessões que você terminar aparecem aqui.</p> : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {sessions.slice(0, 8).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-text">{s.title}</span>
                  <span className="text-xs text-muted">{capitalizeFirst(formatDayLabel(localDate(new Date(s.startedAt), tz), now, tz))}, {formatTime(s.startedAt, tz)}</span>
                </span>
                <span className="font-mono text-body">{s.minutes} min</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---- S08 ----
const SOURCE_NAME = { google: "Google Agenda", outlook: "Outlook" } as const;

export async function AgendaScreen() {
  const { store, now, tz, today } = await serverContext();
  const [settings, events] = await Promise.all([store.getSettings(), store.listEvents()]);
  const until = addDays(today, 14);
  const upcoming = events.filter((e) => { const d = localDate(new Date(e.endsAt), tz); return d >= today && d <= until; });
  const byDay = new Map<string, typeof upcoming>();
  for (const e of upcoming) { const d = localDate(new Date(e.startsAt), tz); byDay.set(d, [...(byDay.get(d) ?? []), e]); }
  const connected = settings.calendars.google || settings.calendars.outlook;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S08" title="Agenda">
        <Link href="/dia/calendario" className="text-sm font-medium text-info hover:underline">Ver no calendário</Link>
      </PageHeader>
      <section aria-labelledby="agendas" className="flex flex-col gap-2">
        <SectionLabel id="agendas">Agendas conectadas</SectionLabel>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["google", "outlook"] as const).map((src) => (
            <li key={src}>
              <Card className="flex items-center gap-3">
                <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-body"><CalendarDays className="size-5" /></span>
                <span className="flex flex-1 flex-col">
                  <span className="font-medium text-text">{SOURCE_NAME[src]}</span>
                  <span className="text-xs text-muted">{settings.calendars[src] ? "conectada · eventos de exemplo" : "não conectada"}</span>
                </span>
                <ActionSwitch checked={settings.calendars[src]} label={`${SOURCE_NAME[src]} conectada`} action={setCalendarConnected.bind(null, src)} />
              </Card>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">A conexão de verdade (login no Google ou na Microsoft) chega com o backend. Por enquanto, ligar mostra eventos de exemplo.</p>
      </section>
      {!connected ? (
        <EmptyState icon={<CalendarX className="size-8" />} title="Nenhuma agenda conectada"
          text="Conecte o Google Agenda ou o Outlook para ver os compromissos aqui, no seu dia e no resumo da manhã." />
      ) : byDay.size === 0 ? (
        <EmptyState icon={<CalendarDays className="size-8" />} title="Nada nos próximos 14 dias" text="Os compromissos das agendas conectadas aparecem aqui." />
      ) : (
        [...byDay.entries()].map(([day, list]) => (
          <section key={day} aria-labelledby={`ag-${day}`} className="flex flex-col gap-2">
            <h2 id={`ag-${day}`} className="text-label text-muted">{formatDayLabel(day, now, tz)}</h2>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
              {list.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="w-24 shrink-0 font-mono text-sm text-body">{formatTime(e.startsAt, tz)}–{formatTime(e.endsAt, tz)}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-text">{e.title}</span>
                    <span className="flex items-center gap-1 text-xs text-muted">
                      {e.location && <><MapPin aria-hidden className="size-3" />{e.location} · </>}{SOURCE_NAME[e.source]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
