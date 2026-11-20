import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  full?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "border border-transparent bg-accent text-on-accent hover:[&:not(:disabled)]:brightness-105",
  secondary:
    "border border-line bg-card text-ink hover:[&:not(:disabled)]:border-accent-30 hover:[&:not(:disabled)]:bg-accent-5",
  ghost: "border border-transparent text-ink hover:[&:not(:disabled)]:bg-ink-5",
  danger: "border border-bad-24 bg-bad-10 text-bad",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-[13px]",
  md: "min-h-11 text-sm",
  lg: "min-h-[52px] px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, full, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-[1.1rem] font-bold tracking-[-0.01em]",
        "transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft",
        "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        sizes[size],
        full && "w-full",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      <span className={cn(loading && "sr-only")}>{children}</span>
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn("size-5 animate-spin text-dim", className)} aria-label="Loading" />;
}
