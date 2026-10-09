"use client";
import { Bell, ChevronLeft, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { updateSettings } from "@/app/actions";
import { signOut } from "@/app/auth-actions";
import { BRAND } from "@/lib/brand";
import type { Settings } from "@/lib/data/types";
import { parentOf, showBackOnDesktop, showBackOnMobile } from "@/lib/navigation";
import { cn } from "./cn";

// Se a pessoa já passou por outra tela nesta visita: com histórico, "voltar" volta de verdade;
// sem (entrou direto pelo link), sobe para a página de cima. Compara o caminho, não conta
// efeitos, porque em desenvolvimento o React roda cada efeito duas vezes.
const visit = globalThis as typeof globalThis & { __lastPath?: string; __hasPrevious?: boolean };

const iconButton = "relative flex size-10 items-center justify-center rounded-full text-body hover:bg-surface-2 hover:text-text";

// Barra de cima das telas logadas: voltar à esquerda; avisos, tema e conta à direita
export function TopBar({ unread, name, email, theme, canSignOut }: {
  unread: number; name: string; email: string; theme: Settings["theme"]; canSignOut: boolean;
}) {
  const path = usePathname() ?? "/";
  const router = useRouter();
  useEffect(() => {
    if (visit.__lastPath && visit.__lastPath !== path) visit.__hasPrevious = true;
    visit.__lastPath = path;
  }, [path]);
  const mobileBack = showBackOnMobile(path), desktopBack = showBackOnDesktop(path);
  const back = () => (visit.__hasPrevious ? router.back() : router.push(parentOf(path)));

  return (
    <header className="sticky top-0 z-20 -mx-4 mb-2 flex h-14 items-center justify-between gap-2 bg-bg/90 px-2 backdrop-blur lg:-mx-8 lg:px-6">
      <div className="flex min-w-0 items-center gap-1">
        {(mobileBack || desktopBack) && (
          <button type="button" onClick={back}
            className={cn("flex h-10 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-medium text-body hover:bg-surface-2 hover:text-text",
              !mobileBack && "max-lg:hidden", !desktopBack && "lg:hidden")}>
            <ChevronLeft aria-hidden className="size-5" />Voltar
          </button>
        )}
        {!mobileBack && <Link href="/conversa" className="px-2 text-base font-bold text-text lg:hidden">{BRAND.name}</Link>}
      </div>
      <div className="flex items-center gap-1">
        <Link href="/avisos" aria-label={unread ? `Avisos (${unread} novo${unread === 1 ? "" : "s"})` : "Avisos"} title="Avisos" className={iconButton}>
          <Bell aria-hidden className="size-5" />
          {unread > 0 && (
            <span aria-hidden className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-on-accent">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <ThemeButton theme={theme} />
        <AccountMenu name={name} email={email} canSignOut={canSignOut} />
      </div>
    </header>
  );
}

// Claro ou escuro com um toque (o automático continua em Jeito do assistente)
function ThemeButton({ theme }: { theme: Settings["theme"] }) {
  const [chosen, setCurrent] = useState<"dark" | "light" | null>(null);
  const [, start] = useTransition();
  const current = chosen ?? (theme === "light" ? "light" : "dark");
  const next = current === "dark" ? "light" : "dark";
  return (
    <button type="button" className={iconButton} aria-label={next === "light" ? "Usar o tema claro" : "Usar o tema escuro"} title="Tema"
      onClick={() => {
        // no automático, o que vale é o que está aplicado agora
        const applied = document.documentElement.dataset.theme === "light" ? "light" : "dark";
        const next = (chosen ?? (theme === "system" ? applied : current)) === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        setCurrent(next);
        start(async () => { await updateSettings({ theme: next }).catch(() => {}); });
      }}>
      {current === "dark" ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
    </button>
  );
}

const MENU: Array<{ href: string; label: string }> = [
  { href: "/ajustes", label: "Ajustes" },
  { href: "/ajustes/assistente", label: "Jeito do assistente" },
  { href: "/planos", label: "Assinatura e planos" },
  { href: "/ajustes/suporte", label: "Falar com uma pessoa" },
  { href: "/conversa?configurar=1", label: "Refazer a configuração inicial" },
];

// Menu da conta: abre e fecha no botão, fecha com Esc, com clique fora ou ao escolher
function AccountMenu({ name, email, canSignOut }: { name: string; email: string; canSignOut: boolean }) {
  const [open, setOpen] = useState(false);
  const [leaving, startLeaving] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button ref={button} type="button" aria-expanded={open} aria-controls="menu-conta" aria-label="Sua conta" onClick={() => setOpen((o) => !o)}
        className="ml-1 flex size-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent hover:opacity-90">
        {initial}
      </button>
      {open && (
        <div id="menu-conta" className="absolute right-0 top-12 z-30 w-64 rounded-lg border border-border bg-surface p-2 shadow-pop">
          <div className="border-b border-border px-3 pb-2 pt-1">
            <p className="truncate text-sm font-semibold text-text">{name}</p>
            {email && <p className="truncate text-xs text-muted">{email}</p>}
          </div>
          <ul className="flex flex-col py-1">
            {MENU.map((m) => (
              <li key={m.href}><Link href={m.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-body hover:bg-surface-2 hover:text-text">{m.label}</Link></li>
            ))}
          </ul>
          {canSignOut && (
            <button type="button" disabled={leaving}
              onClick={() => startLeaving(async () => { await signOut(false); router.push("/entrar"); router.refresh(); })}
              className="flex w-full items-center gap-2 rounded-md border-t border-border px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2">
              <LogOut aria-hidden className="size-4" />{leaving ? "Saindo…" : "Sair"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
