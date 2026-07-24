"use client";

import { Ban, CheckCircle2, Download, Undo2 } from "lucide-react";
import { useState } from "react";
import { ShelfTag } from "@/components/shelf-tag";
import { SignaturePad } from "@/components/signature-pad";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-user";
import { MOVEMENT_LABELS, WRITE_OFF_LABELS, WRITE_OFF_REASONS, type Movement } from "@/lib/types";

type PendingAction = "download" | null;

export function ReceiptSheet({
  movement,
  onClose,
  onCancelled,
  onReturned,
}: {
  movement: Movement | null;
  onClose: () => void;
  /** Called after a dispense/sale is successfully cancelled (e.g. to refetch the log). */
  onCancelled?: () => void;
  /** Called after a return is successfully recorded. */
  onReturned?: () => void;
}) {
  const { can } = useCurrentUser();
  const [signature, setSignature] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMovementId, setLastMovementId] = useState<string | null>(null);
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [returnMode, setReturnMode] = useState(false);
  const [returnQty, setReturnQty] = useState(1);
  const [returnCondition, setReturnCondition] = useState("GOOD");
  const [returnNote, setReturnNote] = useState("");
  const [returnUnitIds, setReturnUnitIds] = useState<Set<string>>(new Set());
  const [returning, setReturning] = useState(false);
  // The prop is a snapshot from the list; after we act, reflect it locally.
  const [justCancelledAt, setJustCancelledAt] = useState<string | null>(null);

  // Reset per-receipt state when a different movement opens — done during
  // render (React's recommended pattern) rather than an effect, since this
  // is derived from a prop change, not a sync with an external system.
  if (movement && movement.id !== lastMovementId) {
    setLastMovementId(movement.id);
    setSignature(null);
    setPending(null);
    setError(null);
    setCancelMode(false);
    setCancelReason("");
    setJustCancelledAt(null);
    setReturnMode(false);
    setReturnQty(Math.max(1, movement.returnableQty ?? 1));
    setReturnCondition("GOOD");
    setReturnNote("");
    setReturnUnitIds(new Set());
  }

  const cancelledAt = movement?.cancelledAt ?? justCancelledAt ?? undefined;
  const returnableQty = movement?.returnableQty ?? 0;
  const canCancel =
    !!movement &&
    (movement.type === "DISPENSE" || movement.type === "SALE") &&
    !cancelledAt &&
    returnableQty === movement.qty &&
    can("movements.cancel");
  const canReturn = canCancel && returnableQty > 0;
  const outstandingUnits = (movement?.lines ?? []).filter((l) => l.unitId);

  const performCancel = async () => {
    if (!movement || !cancelReason.trim() || cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/movements/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: movement.id, reason: cancelReason.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not cancel this movement");
      setJustCancelledAt(body?.cancelledAt ?? new Date().toISOString());
      setCancelMode(false);
      onCancelled?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel this movement");
    } finally {
      setCancelling(false);
    }
  };

  const performReturn = async () => {
    if (!movement || returning) return;
    if (movement.serialized && returnUnitIds.size === 0) {
      setError("Select at least one serial being returned.");
      return;
    }
    setReturning(true);
    setError(null);
    try {
      const res = await fetch("/api/movements/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: movement.id,
          qty: movement.serialized ? undefined : returnQty,
          unitIds: movement.serialized ? [...returnUnitIds] : undefined,
          condition: returnCondition,
          note: returnNote.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not record this return");
      setReturnMode(false);
      setReturnUnitIds(new Set());
      onReturned?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record this return");
    } finally {
      setReturning(false);
    }
  };

  const totalCost = movement ? movement.qty * movement.unitCost : 0;
  const totalAmount = movement?.unitPrice !== undefined ? movement.qty * movement.unitPrice : undefined;

  const requestAction = (action: PendingAction) => {
    setError(null);
    if (action === "download" || signature) {
      void performAction(action);
    } else {
      setPending(action);
    }
  };

  const confirmSignature = () => {
    if (!signature || !pending) return;
    void performAction(pending);
  };

  const performAction = async (action: PendingAction) => {
    if (!movement) return;
    if (action === "download") {
      setDownloading(true);
      setError(null);
      try {
        const res = await fetch("/api/reports/movement-receipt-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...movement, signature }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Could not generate receipt");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nlm-receipt-${movement.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate receipt");
      } finally {
        setDownloading(false);
        setPending(null);
      }
    }
  };

  return (
    <Sheet open={!!movement} onClose={onClose} side="right" title="Movement receipt">
      {movement && (
        <div id="print-area" className="animate-fade-in rounded-xl border-t-2 border-dashed border-line-strong bg-surface">
          <div className="flex items-center gap-2.5 px-1 pb-3">
            {cancelledAt ? (
              <Ban className="h-5 w-5 text-danger" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-success" />
            )}
            <p className="text-sm font-semibold text-ink">
              {MOVEMENT_LABELS[movement.type] ?? movement.type}
            </p>
            {cancelledAt && (
              <span className="rounded bg-danger/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-danger">
                Cancelled
              </span>
            )}
          </div>
          {cancelledAt && (
            <p className="px-1 pb-3 text-xs text-ink-soft">
              Cancelled on{" "}
              {new Date(cancelledAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              — stock was returned and a reversing adjustment was added to the ledger.
            </p>
          )}

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
            {movement.writeOffReason && (
              <Row label="Reason" value={WRITE_OFF_LABELS[movement.writeOffReason]} strong />
            )}
            {movement.note && <Row label="Note" value={movement.note} />}
            {movement.lines.length > 0 && (
              <Row
                label={movement.serialized ? "Serials" : "Batches"}
                value={movement.lines
                  .map((l) => l.serial ?? `${l.batchCode} ×${l.qty}`)
                  .join(", ")}
                mono
              />
            )}
            {movement.type === "DISPENSE" ||
            movement.type === "SALE" ? (
              <Row
                label="Returned so far"
                value={`${movement.qty - returnableQty} / ${movement.qty} ${movement.unit}`}
                mono
              />
            ) : null}
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

          {signature && (
            <div className="border-t border-dashed border-line px-1 pt-3">
              <p className="mb-1.5 text-xs text-ink-soft">Signature of person who availed</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signature} alt="Signature" className="h-20 w-40 object-contain" />
            </div>
          )}

          <div className="no-print space-y-3 px-1 pt-4">
            {pending ? (
              <div>
                <p className="mb-2 text-xs font-medium text-ink-soft">
                  Signature of person who availed — required before downloading
                </p>
                <SignaturePad onChange={setSignature} />
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" disabled={!signature} onClick={confirmSignature}>
                    Confirm &amp; download
                  </Button>
                  <Button variant="outline" onClick={() => setPending(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full"
                disabled={downloading}
                onClick={() => requestAction("download")}
              >
                <Download className="h-4 w-4" /> {downloading ? "Preparing…" : "Download PDF"}
              </Button>
            )}
            {canReturn && !pending && !cancelMode && (
              <div className="border-t border-dashed border-line pt-3">
                {returnMode ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-ink-soft">
                      Bring stock back onto the shelf. Pick the condition it came back in — a
                      damaged/etc. condition restocks it and immediately writes it off again with
                      that reason, so the ledger keeps both entries.
                    </p>
                    {movement.serialized ? (
                      <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg bg-bg p-2">
                        {outstandingUnits.map((l) => (
                          <label
                            key={l.unitId}
                            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-surface"
                          >
                            <input
                              type="checkbox"
                              checked={returnUnitIds.has(l.unitId!)}
                              onChange={() =>
                                setReturnUnitIds((s) => {
                                  const next = new Set(s);
                                  if (next.has(l.unitId!)) next.delete(l.unitId!);
                                  else next.add(l.unitId!);
                                  return next;
                                })
                              }
                              className="h-3.5 w-3.5 accent-brand"
                            />
                            <span className="font-mono text-[11px] font-semibold text-ink">
                              {l.serial}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-ink-soft">
                          Quantity returned ({movement.unit})
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={returnableQty}
                          value={returnQty}
                          onChange={(e) =>
                            setReturnQty(Math.max(1, Math.min(returnableQty, Number(e.target.value) || 1)))
                          }
                          className="h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-[13px] text-ink focus:border-brand focus:outline-none"
                        />
                      </label>
                    )}
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-ink-soft">
                        Condition on return
                      </span>
                      <select
                        value={returnCondition}
                        onChange={(e) => setReturnCondition(e.target.value)}
                        className="h-10 w-full rounded-lg border border-line bg-bg px-3 text-[13px] text-ink focus:border-brand focus:outline-none"
                      >
                        <option value="GOOD">Good — back to stock</option>
                        {WRITE_OFF_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {WRITE_OFF_LABELS[r]} — write off
                          </option>
                        ))}
                      </select>
                    </label>
                    <input
                      type="text"
                      value={returnNote}
                      onChange={(e) => setReturnNote(e.target.value)}
                      placeholder="Note (optional)"
                      maxLength={500}
                      className="h-10 w-full rounded-lg border border-line bg-bg px-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={returning}
                        onClick={() => void performReturn()}
                      >
                        {returning ? "Recording…" : "Record return"}
                      </Button>
                      <Button variant="outline" onClick={() => setReturnMode(false)}>
                        Back
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setReturnMode(true)}
                  >
                    <Undo2 className="h-4 w-4" /> Return {returnableQty} {movement.unit}
                  </Button>
                )}
              </div>
            )}
            {canCancel && !pending && !returnMode && (
              <div className="border-t border-dashed border-line pt-3">
                {cancelMode ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-ink-soft">
                      Why is this being cancelled? Stock will be returned to the shelf and a
                      reversing entry added to the log.
                    </p>
                    <input
                      type="text"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="e.g. Returned by recipient / double entry"
                      maxLength={300}
                      className="h-10 w-full rounded-lg border border-line bg-bg px-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
                    />
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        disabled={!cancelReason.trim() || cancelling}
                        onClick={() => void performCancel()}
                      >
                        {cancelling ? "Cancelling…" : "Confirm cancellation"}
                      </Button>
                      <Button variant="outline" onClick={() => setCancelMode(false)}>
                        Back
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => setCancelMode(true)}
                  >
                    <Ban className="h-4 w-4" /> Cancel this{" "}
                    {movement.type === "SALE" ? "sale" : "dispense"}
                  </Button>
                )}
              </div>
            )}
            {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
          </div>
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
