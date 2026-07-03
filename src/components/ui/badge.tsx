import { cn } from "@/lib/utils";

const VARIANTS = {
  neutral: "bg-line/50 text-ink-soft",
  brand: "bg-brand-tint text-brand-dark",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
} as const;

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
