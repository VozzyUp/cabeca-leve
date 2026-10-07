"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./cn";

// Navegação entre as páginas de uma área (finanças, saúde). São rotas, não abas:
// links com aria-current, e o visual igual ao das abas.
export function SubNav({ label, items }: { label: string; items: Array<{ href: string; label: string }> }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {items.map((i) => {
          const active = path === i.href;
          return (
            <li key={i.href}>
              {/* no celular, a página atual pode estar fora da faixa visível: rola até ela */}
              <Link href={i.href} aria-current={active ? "page" : undefined}
                ref={active ? (el) => { el?.scrollIntoView({ block: "nearest", inline: "center" }); } : undefined}
                className={cn("-mb-px block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active ? "border-accent text-text" : "border-transparent text-muted hover:text-text")}>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
