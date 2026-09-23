"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { BookingDetail } from "@/components/guesthouse/booking-detail";
import { useFetch } from "@/lib/hooks";
import { formatCurrency } from "@/lib/format";
import { BOOKING_STATUS_LABELS, type GuestDetail } from "@/lib/types";

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  CONFIRMED: "brand",
  CHECKED_IN: "success",
  CHECKED_OUT: "neutral",
  CANCELLED: "danger",
  NO_SHOW: "danger",
};

function formatDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The Guests tab's detail sheet — full stay history, credit balance and the
 *  ledger behind it. Clicking a stay drills into the normal booking detail. */
export function GuestDetailSheet({
  guestId,
  open,
  onClose,
}: {
  guestId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const { data, loading, refetch } = useFetch<GuestDetail>(
    open && guestId ? `/api/guesthouse/guests/${guestId}` : "",
  );

  const bookingLabel = (id?: string) => {
    if (!id || !data) return null;
    const b = data.bookings.find((x) => x.id === id);
    return b ? `${b.roomName} · ${formatDate(b.checkIn)}` : null;
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} side="right" title={data?.guest.name ?? "Guest"}>
        {loading || !data ? (
          <p className="py-10 text-center text-sm text-ink-faint">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="font-display text-lg font-bold text-ink">{data.guest.name}</h3>
              {data.guest.email && <p className="text-xs text-ink-soft">{data.guest.email}</p>}
            </div>

            <div
              className={
                data.creditBalance > 0
                  ? "rounded-xl bg-success-tint px-3.5 py-3 text-success"
                  : "rounded-xl bg-bg px-3.5 py-3 text-ink-soft"
              }
            >
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                Credit balance
              </p>
              <p className="mt-0.5 text-xl font-bold">{formatCurrency(data.creditBalance)}</p>
            </div>

            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Stays ({data.bookings.length})
              </h4>
              {data.bookings.length === 0 ? (
                <p className="text-sm text-ink-faint">No stays yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.bookings.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => setOpenBookingId(b.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg bg-bg px-3.5 py-2.5 text-left text-sm hover:bg-line/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">
                            {b.roomName} · {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {b.complimentary ? "Complimentary" : formatCurrency(b.totals.netTotal)}
                            {b.totals.balance > 0 && !b.complimentary && (
                              <span className="ml-1.5 font-medium text-danger">
                                Due {formatCurrency(b.totals.balance)}
                              </span>
                            )}
                          </p>
                        </div>
                        <Badge variant={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data.credits.length > 0 && (
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Credit history
                </h4>
                <ul className="space-y-1.5">
                  {data.credits.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-start justify-between gap-2 rounded-lg bg-bg px-3.5 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="text-ink">{c.reason ?? (c.amount > 0 ? "Credit issued" : "Credit applied")}</p>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {new Date(c.at).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {bookingLabel(c.sourceBookingId ?? c.usedBookingId)
                            ? ` · ${bookingLabel(c.sourceBookingId ?? c.usedBookingId)}`
                            : ""}
                        </p>
                      </div>
                      <span
                        className={
                          c.amount > 0
                            ? "shrink-0 font-medium text-success"
                            : "shrink-0 font-medium text-ink-soft"
                        }
                      >
                        {c.amount > 0 ? "+" : ""}
                        {formatCurrency(c.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </Sheet>

      <BookingDetail
        key={openBookingId}
        bookingId={openBookingId}
        open={openBookingId !== null}
        onClose={() => setOpenBookingId(null)}
        onChanged={refetch}
      />
    </>
  );
}
