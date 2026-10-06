import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string };

export function Field({ label, hint, error, className, ...rest }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-body">{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-10 rounded-md border bg-bg px-3 text-sm text-text placeholder:text-muted",
          error ? "border-danger" : "border-border-input",
        )}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
