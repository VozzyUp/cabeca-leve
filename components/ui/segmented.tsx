"use client";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "./cn";

type Option<T extends string> = { value: T; label: string };
type SegmentedProps<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

// Escolha única entre poucas opções (dia/semana/mês). Setas mudam a opção.
export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKey(e: KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-border bg-surface p-1">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "h-8 rounded-full px-4 text-sm font-medium transition-colors",
              active ? "bg-surface-3 text-text" : "text-muted hover:text-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
