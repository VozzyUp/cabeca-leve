"use client";
import {
  Bell, BookOpen, CalendarDays, CheckSquare, FolderKanban, LayoutGrid, MessageCircle, Settings, Sprout, Target, Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./cn";

export const navItems = [
  { href: "/conversa", label: "Conversa", icon: MessageCircle },
  { href: "/dia", label: "Meu dia", icon: CalendarDays },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/dinheiro", label: "Dinheiro", icon: Wallet },
  { href: "/habitos", label: "Hábitos", icon: Sprout },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/lembretes", label: "Lembretes", icon: Bell },
  { href: "/notas", label: "Notas", icon: BookOpen },
  { href: "/metas", label: "Metas", icon: Target },
] as const;

// Ativo quando a rota atual é a seção ou está dentro dela
function useIsActive() {
  const path = usePathname() ?? "";
  return (href: string) => path === href || path.startsWith(`${href}/`);
}

// Computador (lg+): trilho lateral só com ícones; o nome aparece no tooltip e no leitor de tela
export function NavRail({ notifications = 0 }: { notifications?: number }) {
  const isActive = useIsActive();
  return (
    <nav aria-label="Seções" className="sticky top-0 flex h-dvh w-[72px] shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-4">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} title={label} aria-label={label} aria-current={isActive(href) ? "page" : undefined}
          className={cn("flex size-11 items-center justify-center rounded-md transition-colors",
            isActive(href) ? "bg-surface-3 text-text" : "text-muted hover:bg-surface-2 hover:text-text")}>
          <Icon aria-hidden className="size-5" />
        </Link>
      ))}
      <Link href="/ajustes" title="Ajustes" aria-label={notifications ? `Ajustes (${notifications} avisos novos)` : "Ajustes"}
        aria-current={isActive("/ajustes") ? "page" : undefined}
        className={cn("relative mt-auto flex size-11 items-center justify-center rounded-md hover:bg-surface-2 hover:text-text",
          isActive("/ajustes") ? "bg-surface-3 text-text" : "text-muted")}>
        <Settings aria-hidden className="size-5" />
        {notifications > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 size-2 rounded-full bg-warning" />}
      </Link>
    </nav>
  );
}

// Celular: Meu dia, Tarefas, [Conversa], Dinheiro, Mais
export function BottomNav() {
  const isActive = useIsActive();
  const left = [navItems[1], navItems[2]];
  const right = [navItems[3], { href: "/mais", label: "Mais", icon: LayoutGrid }];
  const tab = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof LayoutGrid }) => (
    <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}
      className={cn("flex w-16 flex-col items-center gap-0.5 rounded-md py-1 text-[11px] font-medium", isActive(href) ? "text-text" : "text-muted")}>
      <Icon aria-hidden className="size-5" />
      {label}
    </Link>
  );
  return (
    <nav aria-label="Seções" className="flex h-16 items-center justify-around rounded-xl border border-border bg-surface px-2 shadow-pop">
      {left.map(tab)}
      <Link href="/conversa" aria-label="Conversa" aria-current={isActive("/conversa") ? "page" : undefined}
        className="flex size-12 items-center justify-center rounded-full bg-accent text-on-accent">
        <MessageCircle aria-hidden className="size-6" />
      </Link>
      {right.map(tab)}
    </nav>
  );
}
