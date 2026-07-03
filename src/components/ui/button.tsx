"use client";

import { cn } from "@/lib/utils";

const VARIANTS = {
  default:
    "bg-brand text-white shadow-sm hover:bg-brand-dark active:bg-brand-dark",
  accent: "bg-ember text-white shadow-sm hover:bg-ember-dark active:bg-ember-dark",
  outline:
    "bg-surface text-ink shadow-sm ring-1 ring-black/10 hover:bg-bg active:bg-line/60",
  ghost: "text-ink-soft hover:bg-line/50 hover:text-ink",
  destructive: "bg-danger text-white shadow-sm hover:opacity-90",
} as const;

const SIZES = {
  sm: "min-h-9 px-3 text-[13px]",
  default: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-6 text-[15px]",
  icon: "h-11 w-11",
} as const;

export function Button({
  variant = "default",
  size = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
