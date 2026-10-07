import { cn } from "./cn";

// Bloco de carregamento (mesma forma do conteúdo que vem)
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}
