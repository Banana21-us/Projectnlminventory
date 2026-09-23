"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeMinus,
  BadgePlus,
  CalendarPlus,
  Gift,
  History,
  LogIn,
  LogOut,
  Ban,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useFetch } from "@/lib/hooks";
import { useCurrentUser } from "@/lib/use-user";
import { formatCurrency } from "@/lib/format";
import { bookingNotes, previewCharge } from "@/lib/booking-ui";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type Booking,
  type PaymentMethod,
  type RoomAvailabilityDto,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  CONFIRMED: "brand",
  CHECKED_IN: "success",
  CHECKED_OUT: "neutral",
  CANCELLED: "danger",
  NO_SHOW: "danger",
};

const METHODS: PaymentMethod[] = [
  "CASH",
  "GCASH",
  "BANK_TRANSFER",
  "CHECK",
  "CHARGE_TO_DEPARTMENT",
];

type Mode =
  | null
  | "checkout"
  | "settle"
  | "discount"
  | "charge"
  | "cancel"
  | "extend"
  | "move"
  | "adjustNights"
  | "refund"
  | "occupants";

function formatDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Nights between check-in and today, clamped to the booked range. */
function nightsStayedSoFar(booking: Booking): number {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const stayed = Math.round(
    (Date.parse(`${todayStr}T00:00:00Z`) - Date.parse(`${booking.checkIn}T00:00:00Z`)) / 86_400_000,
  );
  return Math.max(1, Math.min(booking.nights, stayed));
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "muted" | "danger" | "success";
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className={cn("text-sm", strong ? "font-medium text-ink" : "text-ink-soft")}>{label}</span>
      <span
        className={cn(
          "text-sm tabular-nums",
          strong && "font-semibold",
          tone === "muted" && "text-ink-faint",
          tone === "danger" && "text-danger",
          tone === "success" && "text-success",
          !tone && "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function BookingDetail({
  bookingId,
  open,
  onClose,
  onChanged,
}: {
  bookingId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { can } = useCurrentUser();
  const isAdmin = can("guesthouse.adjust");

  const { data: booking, loading, refetch } = useFetch<Booking>(
    open && bookingId ? `/api/guesthouse/bookings/${bookingId}` : "",
  );

  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state, shared across the inline action panels.
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [payerId, setPayerId] = useState("");
  const [orNumber, setOrNumber] = useState("");
  const [reason, setReason] = useState("");
  const [newCheckOut, setNewCheckOut] = useState("");
  const [targetRoom, setTargetRoom] = useState("");
  const [billedNights, setBilledNights] = useState("");
  const [occupantsInput, setOccupantsInput] = useState("");

  const { data: payers } = useFetch<{ id: string; name: string }[]>(
    mode === "settle" && method === "CHARGE_TO_DEPARTMENT" ? "/api/guesthouse/payers" : "",
  );
  const { data: moveRooms } = useFetch<RoomAvailabilityDto[]>(
    mode === "move" && booking
      ? `/api/guesthouse/rooms?from=${booking.checkIn}&to=${booking.checkOut}&excludeBookingId=${booking.id}`
      : "",
  );

  /** Opens a panel and seeds its fields from the current booking — done at
   *  the point of the click, not synced back in an effect. */
  function openPanel(next: Exclude<Mode, null>, booking: Booking) {
    setError(null);
    setAmount(String(booking.totals.balance > 0 ? booking.totals.balance : ""));
    setMethod("CASH");
    setPayerId("");
    setOrNumber("");
    setReason("");
    setNewCheckOut(booking.checkOut);
    setTargetRoom("");
    setBilledNights(String(booking.billedNights));
    setOccupantsInput(String(booking.actualOccupants ?? booking.occupants));
    setMode(next);
  }

  async function send(url: string, body: unknown, successTitle: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: url.includes("/payments") || url.includes("/adjustments") ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "That did not work");
      toast({ kind: "success", title: successTitle });
      setMode(null);
      refetch();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work");
    } finally {
      setBusy(false);
    }
  }

  const act = (body: unknown, title: string) =>
    send(`/api/guesthouse/bookings/${bookingId}`, body, title);

  if (!open) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Booking" side="right">
      {loading && <p className="py-10 text-center text-sm text-ink-faint">Loading…</p>}

      {booking && (
        <div className="space-y-5">
          {/* ── Header ── */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">{booking.guestName}</h3>
                <p className="text-sm text-ink-soft">
                  {booking.roomName} · {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}
                </p>
              </div>
              <Badge variant={STATUS_TONE[booking.status]}>
                {BOOKING_STATUS_LABELS[booking.status]}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {booking.nights} night{booking.nights > 1 ? "s" : ""} booked
              {booking.billedNights !== booking.nights && ` · ${booking.billedNights} billed`}
              {booking.occupants > 1 && ` · ${booking.occupants} guests`}
              {booking.contact && ` · ${booking.contact}`}
              {booking.groupName && ` · ${booking.groupName}`}
            </p>
            {bookingNotes(booking).length > 0 && (
              <p className="mt-1 text-xs font-medium text-brand-dark">
                {bookingNotes(booking).join(" · ")}
              </p>
            )}
            {booking.complimentary && (
              <p className="mt-2 flex items-center gap-2 rounded-lg bg-success-tint px-3 py-2 text-sm text-success">
                <Gift className="h-4 w-4" />
                Complimentary — {booking.compReason ?? "no charge"}
                {booking.notionalValue ? ` (worth ${formatCurrency(booking.notionalValue)})` : ""}
              </p>
            )}
            {booking.cancelReason && (
              <p className="mt-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                {booking.cancelReason}
              </p>
            )}
          </div>

          {/* ── Folio ── */}
          {!booking.complimentary && (
            <section className="rounded-xl bg-bg p-3.5">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Folio
              </h4>
              {booking.stays && booking.stays.length > 1 ? (
                booking.stays.map((s, i) => {
                  const nights = Math.round(
                    (Date.parse(`${s.to}T00:00:00Z`) - Date.parse(`${s.from}T00:00:00Z`)) / 86_400_000,
                  );
                  return (
                    <Row
                      key={i}
                      label={`${s.roomName} × ${nights} night${nights > 1 ? "s" : ""} @ ${formatCurrency(s.rate)}`}
                      value={formatCurrency(nights * s.rate)}
                    />
                  );
                })
              ) : (
                <Row
                  label={`${booking.roomName} × ${booking.billedNights} night${booking.billedNights > 1 ? "s" : ""} @ ${formatCurrency(booking.nightlyRate)}`}
                  value={formatCurrency(booking.totals.charge)}
                />
              )}
              {booking.adjustments
                ?.filter((a) => a.kind === "DISCOUNT")
                .map((a) => (
                  <Row
                    key={a.id}
                    label={`Less — ${a.reason}`}
                    value={`−${formatCurrency(a.amount)}`}
                    tone="success"
                  />
                ))}
              {booking.adjustments
                ?.filter((a) => a.kind === "CHARGE")
                .map((a) => (
                  <Row key={a.id} label={a.reason} value={formatCurrency(a.amount)} />
                ))}
              <div className="my-1.5 border-t border-line" />
              <Row label="Net total" value={formatCurrency(booking.totals.netTotal)} strong />
              {booking.payments?.map((p) => (
                <Row
                  key={p.id}
                  label={`${new Date(p.paidAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} · ${PAYMENT_METHOD_LABELS[p.method]}${p.payerName ? ` (${p.payerName})` : ""}${p.orNumber ? ` · OR ${p.orNumber}` : ""}`}
                  value={p.amount < 0 ? `+${formatCurrency(Math.abs(p.amount))}` : `−${formatCurrency(p.amount)}`}
                  tone="muted"
                />
              ))}
              <div className="my-1.5 border-t border-line" />
              <Row
                label={booking.totals.balance < 0 ? "Refund due" : "Balance"}
                value={formatCurrency(Math.abs(booking.totals.balance))}
                strong
                tone={
                  booking.totals.balance > 0
                    ? "danger"
                    : booking.totals.balance < 0
                      ? "danger"
                      : "success"
                }
              />
            </section>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {/* ── Inline action panels ── */}
          {mode === "occupants" && (
            <section className="space-y-3 rounded-xl border border-brand/40 bg-surface p-3.5">
              <h4 className="text-sm font-semibold text-ink">Headcount</h4>
              <p className="text-xs text-ink-soft">
                Booked for {booking.occupants}. Record who actually showed up — this is a flag for
                the front desk, it doesn&apos;t change the charge.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-soft">Arrived</span>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={occupantsInput}
                  onChange={(e) => setOccupantsInput(e.target.value)}
                  className="w-20"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy || !occupantsInput}
                  onClick={() =>
                    act(
                      { action: "setOccupants", actualOccupants: Number(occupantsInput) },
                      "Headcount recorded",
                    )
                  }
                >
                  Save
                </Button>
              </div>
            </section>
          )}

          {mode === "checkout" && (
            <section className="space-y-3 rounded-xl border border-brand/40 bg-surface p-3.5">
              <h4 className="text-sm font-semibold text-ink">Check out</h4>
              {Number(billedNights) < booking.nights && (
                <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
                  Early checkout — booked {booking.nights} night{booking.nights > 1 ? "s" : ""}, the
                  guest stayed {billedNights}. The unused nights free up straight away.
                </p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-soft">Bill for</span>
                <Input
                  type="number"
                  min={1}
                  max={booking.nights}
                  value={billedNights}
                  onChange={(e) => setBilledNights(e.target.value)}
                  className="w-20"
                />
                <span className="text-sm text-ink-soft">
                  night{Number(billedNights) > 1 ? "s" : ""} ·{" "}
                  {formatCurrency(previewCharge(booking, Number(billedNights || 0)))}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    act(
                      { action: "checkOut", billedNights: Number(billedNights) },
                      "Checked out",
                    )
                  }
                >
                  Check out
                </Button>
              </div>
            </section>
          )}

          {mode === "settle" && (
            <section className="space-y-3 rounded-xl border border-brand/40 bg-surface p-3.5">
              <h4 className="text-sm font-semibold text-ink">Record payment</h4>
              <div className="flex flex-wrap gap-1.5">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      method === m ? "bg-brand text-white" : "bg-line/50 text-ink-soft",
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
              {method === "CHARGE_TO_DEPARTMENT" && (
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink"
                >
                  <option value="">Which department or church?</option>
                  {payers?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(String(booking.totals.balance))}
                >
                  Full
                </Button>
              </div>
              <Input
                value={orNumber}
                onChange={(e) => setOrNumber(e.target.value)}
                placeholder="OR / reference number"
              />
              <p className="text-xs text-ink-faint">
                Balance after: {formatCurrency(booking.totals.balance - Number(amount || 0))}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    send(
                      `/api/guesthouse/bookings/${bookingId}/payments`,
                      {
                        amount: Number(amount),
                        method,
                        ...(method === "CHARGE_TO_DEPARTMENT" ? { payerId } : {}),
                        ...(orNumber.trim() ? { orNumber: orNumber.trim() } : {}),
                      },
                      "Payment recorded",
                    )
                  }
                >
                  Record
                </Button>
              </div>
            </section>
          )}

          {(mode === "discount" || mode === "charge") && (
            <section className="space-y-3 rounded-xl border border-brand/40 bg-surface p-3.5">
              <h4 className="text-sm font-semibold text-ink">
                {mode === "discount" ? "Apply discount (less)" : "Add charge"}
              </h4>
              {mode === "discount" && (booking.payments?.length ?? 0) > 0 && (
                <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
                  This stay is already settled — a discount has to be applied before payment.
                </p>
              )}
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount in pesos"
              />
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={mode === "discount" ? "Reason (e.g. worker courtesy)" : "What for?"}
              />
              <p className="text-xs text-ink-faint">
                New net total:{" "}
                {formatCurrency(
                  booking.totals.netTotal +
                    (mode === "discount" ? -Number(amount || 0) : Number(amount || 0)),
                )}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    send(
                      `/api/guesthouse/bookings/${bookingId}/adjustments`,
                      {
                        kind: mode === "discount" ? "DISCOUNT" : "CHARGE",
                        amount: Number(amount),
                        reason,
                      },
                      mode === "discount" ? "Discount applied" : "Charge added",
                    )
                  }
                >
                  Apply
                </Button>
              </div>
            </section>
          )}

          {mode === "cancel" && (
            <section className="space-y-3 rounded-xl border border-danger/40 bg-surface p-3.5">
              <h4 className="text-sm font-semibold text-ink">Cancel booking</h4>
              <p className="text-xs text-ink-soft">
                {booking.roomName} frees up for {formatDate(booking.checkIn)} –{" "}
                {formatDate(booking.checkOut)} immediately. This cannot be undone — a change of mind
                is a new booking.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Guest cancelled", "Room unavailable", "Other"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium",
                      reason === r ? "bg-danger text-white" : "bg-line/50 text-ink-soft",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required)"
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setMode(null)}>
                  Keep booking
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={busy || !reason.trim()}
                  onClick={() => act({ action: "cancel", reason: reason.trim() }, "Booking cancelled")}
                >
                  Cancel it
                </Button>
              </div>
            </section>
          )}

          {mode === "extend" && (
            <section className="space-y-3 rounded-xl border border-brand/40 bg-surface p-3.5">
              <h4 className="text-sm font-semibold text-ink">Change check-out date</h4>
              <Input
                type="date"
                value={newCheckOut}
                onChange={(e) => setNewCheckOut(e.target.value)}
              />
              <p className="text-xs text-ink-faint">
                If the room is taken for the extra nights, move the guest to another room instead.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() => act({ action: "changeDates", checkOut: newCheckOut }, "Dates updated")}
                >
                  Update
                </Button>
              </div>
            </section>
          )}

          {mode === "move" && (
            <section className="space-y-3 rounded-xl border border-brand/40 bg-surface p-3.5">
              <h4 className="text-sm font-semibold text-ink">Move to another room</h4>
              <p className="text-xs text-ink-soft">
                Nights before the move stay at {formatCurrency(booking.nightlyRate)}; nights after
                bill at the new room&apos;s own rate.
              </p>
              <select
                value={targetRoom}
                onChange={(e) => setTargetRoom(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink"
              >
                <option value="">Pick a room</option>
                {moveRooms
                  ?.filter((r) => r.id !== booking.roomId && r.free)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {formatCurrency(r.rate)}/night
                    </option>
                  ))}
              </select>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (e.g. aircon repair)"
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy || !targetRoom || !reason.trim()}
                  onClick={() =>
                    act(
                      { action: "changeRoom", roomId: targetRoom, reason: reason.trim() },
                      "Room changed",
                    )
                  }
                >
                  Move
                </Button>
              </div>
            </section>
          )}

          {mode === "adjustNights" && (
            <section className="space-y-3 rounded-xl border border-brand/40 bg-surface p-3.5">
              <h4 className="text-sm font-semibold text-ink">Adjust charge</h4>
              <p className="text-xs text-ink-soft">
                Booked {booking.nights} night{booking.nights > 1 ? "s" : ""} · currently billed{" "}
                {booking.billedNights}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-soft">Bill for</span>
                <Input
                  type="number"
                  min={1}
                  max={booking.nights}
                  value={billedNights}
                  onChange={(e) => setBilledNights(e.target.value)}
                  className="w-20"
                />
                <span className="text-sm text-ink-soft">nights</span>
              </div>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required)"
              />
              <div className="rounded-lg bg-bg px-3 py-2 text-xs text-ink-soft">
                Charge {formatCurrency(booking.totals.charge)} →{" "}
                {formatCurrency(previewCharge(booking, Number(billedNights || 0)))}
                {booking.totals.paid >
                  previewCharge(booking, Number(billedNights || 0)) -
                    booking.totals.discounts +
                    booking.totals.extraCharges && (
                  <span className="mt-1 block text-danger">
                    ⚠ This leaves a refund due — record it separately once the cash is handed back.
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy || !reason.trim()}
                  onClick={() =>
                    act(
                      {
                        action: "adjustNights",
                        billedNights: Number(billedNights),
                        reason: reason.trim(),
                      },
                      "Charge adjusted",
                    )
                  }
                >
                  Apply
                </Button>
              </div>
            </section>
          )}

          {mode === "refund" && (
            <section className="space-y-3 rounded-xl border border-danger/40 bg-surface p-3.5">
              <h4 className="text-sm font-semibold text-ink">Record refund</h4>
              <p className="text-xs text-ink-soft">
                Handing cash back. This writes a negative payment — the ledger is never edited.
              </p>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount refunded"
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setMode(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={busy}
                  onClick={() =>
                    send(
                      `/api/guesthouse/bookings/${bookingId}/payments`,
                      { amount: -Math.abs(Number(amount)), method: "CASH", note: "Refund" },
                      "Refund recorded",
                    )
                  }
                >
                  Refund
                </Button>
              </div>
            </section>
          )}

          {/* ── Actions ── */}
          {!mode && (
            <div className="grid grid-cols-2 gap-2">
              {booking.status === "PENDING" && (
                <Button className="col-span-2" onClick={() => act({ action: "confirm" }, "Confirmed")}>
                  Confirm booking
                </Button>
              )}
              {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
                <Button className="col-span-2" onClick={() => act({ action: "checkIn" }, "Checked in")}>
                  <LogIn className="h-4 w-4" /> Check in
                </Button>
              )}
              {/* Check-out is ADMIN-only (guesthouse.adjust) — front desk
                  checks guests in but hands closing out a stay to an ADMIN. */}
              {isAdmin && booking.status === "CHECKED_IN" && (
                <Button
                  className="col-span-2"
                  onClick={() => {
                    openPanel("checkout", booking);
                    // Default to the nights actually stayed — an early
                    // departure is recorded, not assumed away.
                    setBilledNights(String(nightsStayedSoFar(booking)));
                  }}
                >
                  <LogOut className="h-4 w-4" /> Check out
                </Button>
              )}
              {(booking.status === "CHECKED_IN" || booking.status === "CHECKED_OUT") && (
                <Button variant="outline" onClick={() => openPanel("occupants", booking)}>
                  <Users className="h-4 w-4" /> Headcount
                </Button>
              )}
              {isAdmin &&
                !booking.complimentary &&
                (booking.status === "CHECKED_IN" || booking.status === "CHECKED_OUT") &&
                booking.totals.balance > 0 && (
                  <Button variant="accent" className="col-span-2" onClick={() => openPanel("settle", booking)}>
                    <Wallet className="h-4 w-4" /> Record payment
                  </Button>
                )}
              {(booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") && (
                <>
                  <Button variant="outline" onClick={() => openPanel("extend", booking)}>
                    <CalendarPlus className="h-4 w-4" /> Dates
                  </Button>
                  <Button variant="outline" onClick={() => openPanel("move", booking)}>
                    <ArrowRightLeft className="h-4 w-4" /> Move room
                  </Button>
                </>
              )}
              {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
                <>
                  <Button variant="outline" onClick={() => openPanel("cancel", booking)}>
                    <Ban className="h-4 w-4" /> Cancel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => act({ action: "noShow" }, "Marked as no-show")}
                  >
                    <UserX className="h-4 w-4" /> No-show
                  </Button>
                </>
              )}
              {isAdmin && !booking.complimentary && booking.status !== "CANCELLED" && (
                <>
                  <Button
                    variant="outline"
                    disabled={(booking.payments?.length ?? 0) > 0}
                    title={
                      (booking.payments?.length ?? 0) > 0
                        ? "Already settled — discounts must be applied before payment"
                        : undefined
                    }
                    onClick={() => openPanel("discount", booking)}
                  >
                    <BadgeMinus className="h-4 w-4" /> Discount
                  </Button>
                  <Button variant="outline" onClick={() => openPanel("charge", booking)}>
                    <BadgePlus className="h-4 w-4" /> Add charge
                  </Button>
                </>
              )}
              {isAdmin && booking.status === "CHECKED_OUT" && (
                <Button variant="outline" onClick={() => openPanel("adjustNights", booking)}>
                  Adjust nights
                </Button>
              )}
              {isAdmin && booking.totals.balance < 0 && (
                <Button variant="outline" onClick={() => openPanel("refund", booking)}>
                  Record refund
                </Button>
              )}
            </div>
          )}

          {/* ── History ── */}
          {booking.events && booking.events.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <History className="h-3.5 w-3.5" /> History
              </h4>
              <ul className="space-y-1.5">
                {booking.events.map((e) => (
                  <li key={e.id} className="flex gap-2 text-xs text-ink-soft">
                    <span className="shrink-0 tabular-nums text-ink-faint">
                      {new Date(e.at).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span>
                      {e.type.replace(/_/g, " ").toLowerCase()}
                      {e.detail ? ` — ${e.detail}` : ""}
                      <span className="text-ink-faint"> · {e.actor}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {booking.stays && booking.stays.length > 1 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Rooms used
              </h4>
              <ul className="space-y-1 text-xs text-ink-soft">
                {booking.stays.map((s, i) => (
                  <li key={i}>
                    {s.roomName} · {formatDate(s.from)} → {formatDate(s.to)}
                    {s.reason ? ` — ${s.reason}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}
