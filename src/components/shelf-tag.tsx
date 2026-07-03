import { cn } from "@/lib/utils";

/**
 * Signature bracketed shelf-location badge: [ B2-04 ]
 * Used anywhere an item's shelf/location code appears.
 */
export function ShelfTag({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded bg-bg px-1.5 py-px font-mono text-[11px] font-medium tracking-tight text-ink-soft ring-1 ring-black/8",
        className,
      )}
    >
      [&thinsp;{code}&thinsp;]
    </span>
  );
}
