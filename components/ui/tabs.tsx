"use client";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

type Tab = { id: string; label: string; content: ReactNode };
type TabsProps = { label: string; tabs: Tab[]; value: string; onChange: (id: string) => void };

// Abas das áreas (finanças: resumo, variáveis...). Padrão WAI-ARIA com setas, Home e End.
export function Tabs({ label, tabs, value, onChange }: TabsProps) {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKey(e: KeyboardEvent, i: number) {
    const map: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = (map[e.key] + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }
  const current = tabs.find((t) => t.id === value) ?? tabs[0];
  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t, i) => {
          const active = t.id === current.id;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[i] = el; }}
              id={`${base}-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active ? "border-accent text-text" : "border-transparent text-muted hover:text-text",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div id={`${base}-panel-${current.id}`} role="tabpanel" aria-labelledby={`${base}-tab-${current.id}`} tabIndex={0} className="pt-4">
        {current.content}
      </div>
    </div>
  );
}
