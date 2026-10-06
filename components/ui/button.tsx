import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:opacity-90 active:opacity-80",
  secondary: "bg-surface-2 text-text border border-border hover:bg-surface-3",
  ghost: "text-body hover:bg-surface-2 hover:text-text",
  danger: "bg-surface-2 text-danger border border-border hover:bg-surface-3",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "primary", size = "md", loading = false, icon, disabled, className, children, ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icon}
      {/* o rótulo continua no lugar durante o carregamento, para leitores de tela */}
      <span>{children}</span>
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: Size;
  badge?: number;
};

export function IconButton({ label, size = "md", badge, className, children, ...rest }: IconButtonProps) {
  const box = { sm: "size-8", md: "size-10", lg: "size-12" }[size];
  return (
    <button
      type="button"
      aria-label={badge ? `${label} (${badge} novas)` : label}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full text-body transition-colors",
        "hover:bg-surface-2 hover:text-text disabled:opacity-50",
        box, className,
      )}
      {...rest}
    >
      {children}
      {badge ? (
        <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-on-accent">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}
