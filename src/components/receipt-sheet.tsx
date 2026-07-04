"use client";

import { CheckCircle2 } from "lucide-react";
import { ShelfTag } from "@/components/shelf-tag";
import { Sheet } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/format";
import { MOVEMENT_LABELS, type Movement } from "@/lib/types";

export function ReceiptSheet({
  movement,
  onClose,
}: {
  movement: Movement | null;
  onClose: () => void;
}) {
  const totalCost = movement ? movement.qty * movement.unitCost : 0;
  const totalAmount = movement?.unitPrice !== undefined ? movement.qty * movement.unitPrice : undefined;

  return (
    <Sheet open={!!movement} onClose={onClose} side="right" title="Movement receipt">
      {movement && (
        <div className="animate-fade-in rounded-xl border-t-2 border-dashed border-line-strong bg-surface">
          <div className="flex items-center gap-2.5 px-1 pb-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <p className="text-sm font-semibold text-ink">
              {MOVEMENT_LABELS[movement.type] ?? movement.type}
            </p>
          </div>

          <div className="space-y-1 border-y border-dashed border-line px-1 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-semibold text-ink">
                {movement.itemName}
              </span>
              <ShelfTag code={movement.shelf} />
            </div>
            {movement.category && (
              <p className="text-xs text-ink-faint">
                {movement.category} · {movement.location}
              </p>
            )}
          </div>

          <dl className="space-y-2 px-1 py-4 text-[13px]">
            <Row label="Quantity" value={`${movement.qty} ${movement.unit}`} mono />
            <Row label="Unit cost" value={formatCurrency(movement.unitCost)} mono />
            <Row label="Total cost" value={formatCurrency(totalCost)} mono strong />
            {movement.unitPrice !== undefined && (
              <>
                <Row label="Unit price" value={formatCurrency(movement.unitPrice)} mono />
                <Row label="Total amount" value={formatCurrency(totalAmount!)} mono strong />
              </>
            )}
            {movement.orNumber && <Row label="OR number" value={movement.orNumber} mono />}
            {movement.purpose && <Row label="Purpose" value={movement.purpose.replaceAll("_", " ")} />}
            {movement.issuedTo && <Row label="Issued to" value={movement.issuedTo} />}
            {movement.reference && <Row label="Reference" value={movement.reference} />}
            {movement.note && <Row label="Note" value={movement.note} />}
          </dl>

          <dl className="space-y-1.5 border-t border-dashed border-line px-1 pt-3 text-[13px] text-ink-soft">
            <Row label="Staff" value={movement.staff} />
            <Row
              label="Date"
              value={new Date(movement.at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              mono
            />
          </dl>
        </div>
      )}
    </Sheet>
  );
}

function Row({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd
        className={[
          "text-right",
          mono ? "font-mono" : "",
          strong ? "font-semibold text-ink" : "font-medium text-ink",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
