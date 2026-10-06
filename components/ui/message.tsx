import type { ReactNode } from "react";
import { cn } from "./cn";

type MessageProps = { from: "user" | "assistant"; children: ReactNode; status?: "sending" | "error" };

export function Message({ from, children, status }: MessageProps) {
  const mine = from === "user";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] text-sm leading-6",
          mine ? "rounded-xl rounded-br-sm bg-surface-2 px-4 py-2.5 text-text" : "text-body",
          status === "sending" && "opacity-60",
        )}
      >
        <span className="sr-only">{mine ? "Você:" : "Assistente:"}</span>
        {children}
        {status === "error" && <p className="mt-1 text-xs text-danger">Não enviada. Toque para tentar de novo.</p>}
      </div>
    </div>
  );
}

// Etapas enquanto o assistente trabalha ("salvando o gasto…")
export function Steps({ steps }: { steps: Array<{ label: string; done: boolean }> }) {
  return (
    <ul aria-live="polite" className="flex flex-col gap-1">
      {steps.map((s) => (
        <li key={s.label} className={cn("flex items-center gap-2 text-xs", s.done ? "text-muted" : "text-body")}>
          <span aria-hidden className={cn("size-1.5 rounded-full", s.done ? "bg-success" : "animate-pulse bg-info")} />
          {s.label}
          <span className="sr-only">{s.done ? "(feito)" : "(em andamento)"}</span>
        </li>
      ))}
    </ul>
  );
}
