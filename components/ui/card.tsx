import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-surface p-4 shadow-card", className)} {...rest} />;
}

export function SectionLabel({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-label text-muted", className)} {...rest} />;
}
