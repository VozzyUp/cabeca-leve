"use client";
import {
  Bell, BookOpen, CalendarDays, CheckSquare, FolderKanban, HeartPulse, LayoutGrid, MessageCircle, Repeat, Sprout, Target, Timer, Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand";
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

// Menu lateral do computador, em grupos e com o nome de cada seção à vista
const SIDEBAR: Array<{ title?: string; items: Array<{ href: string; label: string; icon: typeof Bell }> }> = [
  { items: [navItems[0], navItems[1], navItems[2], navItems[3]] },
  { title: "Organização", items: [navItems[6], navItems[5], navItems[7], { href: "/foco", label: "Modo foco", icon: Timer }, { href: "/automacoes", label: "Revisões", icon: Repeat }] },
  { title: "Saúde e rotina", items: [navItems[4], { href: "/saude", label: "Saúde", icon: HeartPulse }, navItems[8]] },
];

// Ativo quando a rota atual é a seção ou está dentro dela
function useIsActive() {
  const path = usePathname() ?? "";
  return (href: string) => path === href || path.startsWith(`${href}/`);
}

// Computador (lg+): menu lateral com nomes. Avisos, tema e conta ficam na barra de cima.
export function NavRail() {
  const isActive = useIsActive();
  return (
    <nav aria-label="Seções" className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-surface px-3 py-5">
      <Link href="/conversa" className="px-3 text-lg font-bold text-text">{BRAND.name}</Link>
      {SIDEBAR.map((g, i) => (
        <div key={g.title ?? i} className="flex flex-col gap-0.5">
          {g.title && <p className="px-3 pb-1 text-label text-muted">{g.title}</p>}
          {g.items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}
              className={cn("flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                isActive(href) ? "bg-surface-3 text-text" : "text-body hover:bg-surface-2 hover:text-text")}>
              <Icon aria-hidden className="size-5 shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      ))}
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
