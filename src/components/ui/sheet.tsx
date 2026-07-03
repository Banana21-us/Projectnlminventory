"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function Sheet({
  open,
  onClose,
  side = "bottom",
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: "bottom" | "right";
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="animate-fade-in absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute flex flex-col bg-surface shadow-2xl",
          side === "bottom"
            ? "animate-sheet-up inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
            : "animate-sheet-right inset-y-0 right-0 w-full max-w-md",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          {side === "bottom" && (
            <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong" />
          )}
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="-m-2 rounded-lg p-2 text-ink-faint hover:bg-line/50 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
