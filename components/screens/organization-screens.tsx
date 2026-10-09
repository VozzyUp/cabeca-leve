import { Bell, CalendarClock, CreditCard, FolderKanban, Info, LifeBuoy, Megaphone, Receipt, Sparkles, Target, Workflow } from "lucide-react";
import Link from "next/link";
import { markNoticesRead, setAutomationActive, setMilestoneDone } from "@/app/actions";
import { ActionButton, ActionCheck, ActionSwitch } from "@/components/ui/action-controls";
import { Card, SectionLabel } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState, Progress } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/load-error";
import { describeWeekdays } from "@/lib/assistant/weekdays";
import type { Automation, Goal, Notice, Project } from "@/lib/data/types";
import { goalPace } from "@/lib/domain/goals";
import { serverContext } from "@/lib/server";
import { formatDayLabel, formatMoney, formatShortDate, formatTime, localDate } from "@/lib/time";
import { GoalProgressForm } from "./goal-progress-form";
import { NotesBoard } from "./notes-board";

const daysUntil = (day: string, today: string) => Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);

function dueText(dueOn: string | null, today: string) {
  if (!dueOn) return "sem prazo";
  const d = daysUntil(dueOn, today);
  if (d < 0) return `prazo passou há ${-d} dia${d === -1 ? "" : "s"}`;
  if (d === 0) return "prazo hoje";
  return `prazo ${formatShortDate(dueOn)} · faltam ${d} dia${d === 1 ? "" : "s"}`;
}

// ---- S10 ----
function ProjectCard({ project, today }: { project: Project; today: string }) {
  const done = project.milestones.filter((m) => m.done).length;
  const total = project.milestones.length;
  const late = project.status === "active" && project.dueOn !== null && project.dueOn < today;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-text">{project.name}</h2>
          {project.description && <p className="text-sm text-muted">{project.description}</p>}
        </div>
        {late && <span className="shrink-0 rounded-full border border-warning px-2 py-0.5 text-xs text-warning">atrasado</span>}
      </div>
      <Progress label={`${done} de ${total} etapas`} value={done} max={Math.max(1, total)} />
      <p className={cn("text-xs", late ? "text-warning" : "text-muted")}>{project.status === "done" ? "concluído" : dueText(project.dueOn, today)}</p>
      {project.status === "active" && (
        <ul aria-label={`Etapas de ${project.name}`} className="-mx-2 flex flex-col">
          {project.milestones.map((m) => (
            <li key={m.id}><ActionCheck title={m.title} checked={m.done} action={setMilestoneDone.bind(null, project.id, m.id)} /></li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export async function ProjectsScreen() {
  const { store, today } = await serverContext();
  const projects = await store.listProjects();
  const active = projects.filter((p) => p.status === "active");
  const done = projects.filter((p) => p.status === "done");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S10" title="Projetos" />
      {projects.length === 0 ? (
        <EmptyState icon={<FolderKanban className="size-8" />} title="Nenhum projeto"
          text='Diga na conversa: "projeto mudança de apartamento até dia 30, com as etapas visitar, assinar e mudar".' />
      ) : (
        <>
          <section aria-labelledby="proj-ativos" className="flex flex-col gap-2">
            <h2 id="proj-ativos" className="text-label text-muted">Em andamento</h2>
            {active.length === 0 ? <p className="text-sm text-muted">Nenhum projeto em andamento.</p> : (
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">{active.map((p) => <li key={p.id}><ProjectCard project={p} today={today} /></li>)}</ul>
            )}
          </section>
          {done.length > 0 && (
            <section aria-labelledby="proj-feitos" className="flex flex-col gap-2">
              <h2 id="proj-feitos" className="text-label text-muted">Concluídos</h2>
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">{done.map((p) => <li key={p.id}><ProjectCard project={p} today={today} /></li>)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ---- S25 ----
const PACE: Record<string, { text: string; className: string }> = {
  done: { text: "meta batida", className: "border-success text-success" },
  ahead: { text: "à frente", className: "border-success text-success" },
  on_track: { text: "no ritmo", className: "border-border text-body" },
  behind: { text: "atrás", className: "border-warning text-warning" },
  no_deadline: { text: "sem prazo", className: "border-border text-muted" },
};

function goalValue(goal: Goal, v: number) {
  return goal.unit === "money" ? formatMoney(v) : String(v);
}

export async function GoalsScreen() {
  const { store, today } = await serverContext();
  const goals = await store.listGoals();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S25" title="Metas" />
      {goals.length === 0 ? (
        <EmptyState icon={<Target className="size-8" />} title="Nenhuma meta"
          text='Diga na conversa: "quero juntar 20 mil até dezembro" ou "ler 12 livros este ano".' />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {goals.map((g) => {
            const pace = goalPace(g, today);
            const tag = PACE[pace.status];
            return (
              <li key={g.id}>
                <Card className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-text">{g.title}</h2>
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs", tag.className)}>{tag.text}</span>
                  </div>
                  <p className="font-mono text-2xl text-text">{goalValue(g, g.currentValue)}<span className="text-base text-muted"> de {goalValue(g, g.targetValue)}</span></p>
                  <Progress label={`${Math.round(pace.share * 100)}% concluído`} value={Math.min(g.currentValue, g.targetValue)} max={g.targetValue}
                    display={pace.expectedShare !== null ? `esperado ${Math.round(pace.expectedShare * 100)}%` : undefined} />
                  <p className="text-xs text-muted">
                    {dueText(g.dueOn, today)}
                    {pace.perMonthNeeded !== null && pace.perMonthNeeded > 0 && ` · ${goalValue(g, pace.perMonthNeeded)} por mês para chegar lá`}
                  </p>
                  {pace.status !== "done" && <GoalProgressForm goalId={g.id} unit={g.unit} title={g.title} />}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---- S26 ----
export async function NotesScreen() {
  const { store } = await serverContext();
  const notes = await store.listNotes();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S26" title="Notas" />
      <NotesBoard notes={notes} />
    </div>
  );
}

// ---- S27 ----
const CHANNEL: Record<Automation["channel"], string> = { push: "notificação", whatsapp: "WhatsApp", email: "e-mail" };

function scheduleText(a: Automation) {
  const when = a.schedule === "monthly" ? "todo dia 1"
    : a.schedule === "once" ? (a.runOn ? `só em ${formatShortDate(a.runOn)}` : "uma vez")
    : a.weekdays.length === 1 && a.weekdays[0] === 0 ? "todo domingo" : describeWeekdays(a.weekdays);
  return `${when.charAt(0).toUpperCase()}${when.slice(1)} às ${a.time} · por ${CHANNEL[a.channel]}`;
}

export async function AutomationsScreen() {
  const { store, now, tz } = await serverContext();
  const automations = await store.listAutomations();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S27" title="Revisões agendadas">
        <Link href="/conversa" className="text-sm font-medium text-accent hover:underline">Criar pela conversa</Link>
      </PageHeader>
      <p className="max-w-2xl text-sm text-body">
        Resumos que o assistente monta com os seus dados e manda no dia e na hora que você escolher. Para criar uma, peça na conversa:
        &ldquo;toda sexta às 18h me manda quanto gastei na semana&rdquo;.
      </p>
      {automations.length === 0 ? (
        <EmptyState icon={<Workflow className="size-8" />} title="Nenhuma revisão agendada"
          text='Peça na conversa: "todo dia às 7h me manda o resumo do dia no WhatsApp".' />
      ) : (
        <ul className="flex flex-col gap-3">
          {automations.map((a) => (
            <li key={a.id}>
              <Card className={cn("flex items-start gap-4", !a.active && "opacity-70")}>
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-body"><CalendarClock className="size-5" /></span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="font-semibold text-text">{a.title}</h2>
                  <p className="text-sm text-body">{scheduleText(a)}</p>
                  <p className="text-sm text-muted">&ldquo;{a.prompt}&rdquo;</p>
                  <p className="text-xs text-muted">
                    {!a.active ? "pausada" : a.lastRunAt
                      ? `última: ${formatDayLabel(localDate(new Date(a.lastRunAt), tz), now, tz)} às ${formatTime(a.lastRunAt, tz)}`
                      : "ainda não rodou"}
                  </p>
                </div>
                <ActionSwitch checked={a.active} label={`${a.title} ativa`} action={setAutomationActive.bind(null, a.id)} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- S28 ----
const NOTICE_ICON: Record<Notice["kind"], typeof Bell> = { reminder: Bell, briefing: Sparkles, automation: CalendarClock, bill: Receipt, system: Info, support: LifeBuoy, billing: CreditCard };

function ago(iso: string, now: Date, tz: string) {
  const min = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h`;
  return `${formatDayLabel(localDate(new Date(iso), tz), now, tz)}, ${formatTime(iso, tz)}`;
}

function NoticeList({ items, now, tz }: { items: Notice[]; now: Date; tz: string }) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
      {items.map((n) => {
        const Icon = NOTICE_ICON[n.kind];
        const body = (
          <>
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-body"><Icon className="size-4" /></span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2 text-sm font-medium text-text">
                {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="não lido" role="img" />}{n.title}
              </span>
              <span className="text-sm text-body">{n.body}</span>
              <span className="mt-0.5 text-xs text-muted">{ago(n.createdAt, now, tz)}</span>
            </span>
          </>
        );
        return (
          <li key={n.id}>
            {n.href
              ? <Link href={n.href} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2">{body}</Link>
              : <div className="flex items-start gap-3 px-4 py-3">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export async function NoticesScreen() {
  const { store, now, tz } = await serverContext();
  const notices = await store.listNotices();
  const unread = notices.filter((n) => !n.readAt);
  const read = notices.filter((n) => n.readAt);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="S28" title="Avisos">
        {unread.length > 0 && <ActionButton variant="secondary" size="sm" action={markNoticesRead.bind(null, "all")}>Marcar todos como lidos</ActionButton>}
      </PageHeader>
      {notices.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-8" />} title="Nenhum aviso"
          text="Lembretes, resumos e alertas de contas que o assistente mandar ficam guardados aqui." />
      ) : (
        <>
          <section aria-labelledby="avisos-novos" className="flex flex-col gap-2">
            <SectionLabel id="avisos-novos">Novos{unread.length ? ` (${unread.length})` : ""}</SectionLabel>
            {unread.length ? <NoticeList items={unread} now={now} tz={tz} /> : <p className="text-sm text-muted">Tudo lido.</p>}
          </section>
          {read.length > 0 && (
            <section aria-labelledby="avisos-lidos" className="flex flex-col gap-2">
              <SectionLabel id="avisos-lidos">Anteriores</SectionLabel>
              <NoticeList items={read} now={now} tz={tz} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
