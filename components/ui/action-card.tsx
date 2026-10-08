import { Check, ChevronRight, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type ActionCardState = "created" | "undone" | "error";

type ActionCardProps = {
  kind: string;            // "Lembrete", "Gasto", "Tarefa"...
  title: string;
  value?: ReactNode;       // horário ou valor, em destaque
  valueTone?: "neutral" | "income" | "expense";
  meta?: string;           // linha de detalhes: data, categoria, meio de pagamento
  state?: ActionCardState;
  openLabel?: string;      // "Ver nos lembretes"
  onOpen?: () => void;
  onUndo?: () => void;
};

const tones = { neutral: "text-text", income: "text-income", expense: "text-expense" };

// Card que o assistente devolve no chat para cada item que criou ou mudou
export function ActionCard({
  kind, title, value, valueTone = "neutral", meta, state = "created", openLabel, onOpen, onUndo,
}: ActionCardProps) {
  const status =
    state === "created" ? `${kind} salvo` : state === "undone" ? `${kind} desfeito` : `Não deu para salvar`;
  return (
    <article
      aria-label={`${status}: ${title}`}
      className={cn(
        "w-full max-w-sm rounded-lg border bg-surface p-4 shadow-card",
        state === "error" ? "border-danger" : "border-border",
        state === "undone" && "opacity-60",
      )}
    >
      <header className="flex items-center justify-between">
        <p className={cn("text-label", state === "error" ? "text-danger" : "text-muted")}>{status}</p>
        {state === "created" && <Check aria-hidden className="size-4 text-success" />}
      </header>
      <p className={cn("mt-2 text-sm font-medium text-text", state === "undone" && "line-through")}>{title}</p>
      {value != null && <p className={cn("mt-1 text-metric", tones[valueTone])}>{value}</p>}
      {meta && <p className="mt-1 text-xs text-muted">{meta}</p>}
      {state === "created" && (onUndo || onOpen) && (
        <footer className="mt-3 flex items-center justify-between border-t border-border pt-3">
          {onUndo ? (
            <button type="button" onClick={onUndo} className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-body hover:text-text">
              <Undo2 aria-hidden className="size-3.5" /> Desfazer
            </button>
          ) : <span />}
          {onOpen && openLabel && (
            <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-accent hover:underline">
              {openLabel} <ChevronRight aria-hidden className="size-3.5" />
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
