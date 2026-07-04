"use client";

import { Check, Trash2, X } from "lucide-react";
import { useState } from "react";

/** Click once to arm, click the check to actually delete — no native confirm(). */
export function ConfirmDeleteButton({
  label,
  disabled,
  onConfirm,
}: {
  label: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          disabled={disabled}
          onClick={() => {
            setConfirming(false);
            void onConfirm();
          }}
          className="rounded-md p-1.5 text-danger hover:bg-danger-tint disabled:opacity-40"
          aria-label={`Confirm delete ${label}`}
          title="Delete forever"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md p-1.5 text-ink-faint hover:bg-line/60"
          aria-label="Cancel delete"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <button
      disabled={disabled}
      onClick={() => setConfirming(true)}
      className="rounded-md p-1.5 text-ink-faint hover:bg-danger-tint hover:text-danger disabled:opacity-40"
      aria-label={`Delete ${label}`}
      title={`Delete ${label}`}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
