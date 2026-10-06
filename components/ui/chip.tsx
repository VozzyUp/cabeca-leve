import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; icon?: ReactNode };

// Filtro liga/desliga (fontes do calendário, tipos de medida)
export function Chip({ selected = false, icon, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        selected ? "border-accent bg-surface-3 text-text" : "border-border bg-surface text-body hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
