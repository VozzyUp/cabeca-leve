"use client";
import { Bell, BookOpen, CalendarDays, CheckSquare, FolderKanban, MessageCircle, Settings, Sprout, Target, Wallet } from "lucide-react";
import { cn } from "./cn";

export const navItems = [
  { id: "chat", label: "Conversa", icon: MessageCircle },
  { id: "day", label: "Meu dia", icon: CalendarDays },
  { id: "tasks", label: "Tarefas", icon: CheckSquare },
  { id: "money", label: "Dinheiro", icon: Wallet },
  { id: "habits", label: "Hábitos", icon: Sprout },
  { id: "projects", label: "Projetos", icon: FolderKanban },
  { id: "reminders", label: "Lembretes", icon: Bell },
  { id: "notes", label: "Notas", icon: BookOpen },
  { id: "goals", label: "Metas", icon: Target },
] as const;

type NavProps = { current: string; onNavigate: (id: string) => void; notifications?: number };

// Computador (lg+): trilho lateral só com ícones, rótulo no tooltip e para leitor de tela
export function NavRail({ current, onNavigate, notifications = 0 }: NavProps) {
  return (
    <nav aria-label="Seções" className="flex w-[72px] flex-col items-center gap-1 border-r border-border bg-surface py-4">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" title={label} aria-label={label} aria-current={current === id ? "page" : undefined}
          onClick={() => onNavigate(id)}
          className={cn("flex size-11 items-center justify-center rounded-md transition-colors",
            current === id ? "bg-surface-3 text-text" : "text-muted hover:bg-surface-2 hover:text-text")}>
          <Icon aria-hidden className="size-5" />
        </button>
      ))}
      <button type="button" title="Ajustes" aria-label={notifications ? `Ajustes (${notifications} avisos novos)` : "Ajustes"}
        className="relative mt-auto flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text">
        <Settings aria-hidden className="size-5" />
        {notifications > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 size-2 rounded-full bg-warning" />}
      </button>
    </nav>
  );
}

// Celular: barra inferior com as 4 seções principais + botão central da conversa
export function BottomNav({ current, onNavigate }: NavProps) {
  const main = navItems.filter((i) => ["day", "tasks", "money", "habits"].includes(i.id));
  return (
    <nav aria-label="Seções" className="flex h-16 items-center justify-around rounded-xl border border-border bg-surface px-2 shadow-pop">
      {main.slice(0, 2).map(item => <Tab key={item.id} item={item} current={current} onNavigate={onNavigate} />)}
      <button type="button" aria-label="Conversa" aria-current={current === "chat" ? "page" : undefined} onClick={() => onNavigate("chat")}
        className="flex size-12 items-center justify-center rounded-full bg-accent text-on-accent">
        <MessageCircle aria-hidden className="size-6" />
      </button>
      {main.slice(2).map(item => <Tab key={item.id} item={item} current={current} onNavigate={onNavigate} />)}
    </nav>
  );
}

function Tab({ item, current, onNavigate }: { item: (typeof navItems)[number]; current: string; onNavigate: (id: string) => void }) {
  const Icon = item.icon;
  const active = current === item.id;
  return (
    <button type="button" aria-current={active ? "page" : undefined} onClick={() => onNavigate(item.id)}
      className={cn("flex w-16 flex-col items-center gap-0.5 rounded-md py-1 text-[11px] font-medium", active ? "text-text" : "text-muted")}>
      <Icon aria-hidden className="size-5" />
      {item.label}
    </button>
  );
}
