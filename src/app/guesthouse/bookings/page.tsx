"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { GuesthouseTabs } from "@/components/guesthouse/guesthouse-tabs";
import { BookingDetail } from "@/components/guesthouse/booking-detail";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFetch } from "@/lib/hooks";
import { formatCurrency } from "@/lib/format";
import { bookingNotes } from "@/lib/booking-ui";
import { BOOKING_STATUS_LABELS, type Booking, type BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUSES: (BookingStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
];

const STATUS_TONE = {
  PENDING: "warning",
  CONFIRMED: "brand",
  CHECKED_IN: "success",
  CHECKED_OUT: "neutral",
  CANCELLED: "danger",
  NO_SHOW: "danger",
} as const;

function formatDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BookingsListPage() {
  const [status, setStatus] = useState<BookingStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  if (q.trim()) params.set("q", q.trim());

  const { data: bookings, loading, refetch } = useFetch<Booking[]>(
    `/api/guesthouse/bookings?${params.toString()}`,
  );

  return (
    <div className="space-y-5">
      <GuesthouseTabs />
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Bookings</h1>
        <p className="mt-1 text-sm text-ink-soft">Search and review every stay.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search guest, room, group…"
          className="pl-10"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              status === s ? "bg-brand text-white" : "bg-line/50 text-ink-soft",
            )}
          >
            {s === "ALL" ? "All" : BOOKING_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading && <p className="py-10 text-center text-sm text-ink-faint">Loading…</p>}
      {bookings && bookings.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-faint">No bookings match.</p>
      )}

      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {bookings?.map((b) => (
          <button
            key={b.id}
            onClick={() => setOpenId(b.id)}
            className="w-full rounded-xl bg-surface p-3.5 text-left shadow-sm ring-1 ring-black/5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{b.guestName}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {b.roomName} · {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                </p>
              </div>
              <Badge variant={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">
              {b.complimentary ? "Complimentary" : formatCurrency(b.totals.netTotal)}
              {b.totals.balance > 0 && !b.complimentary && (
                <span className="ml-2 font-medium text-danger">
                  Due {formatCurrency(b.totals.balance)}
                </span>
              )}
            </p>
            {bookingNotes(b).length > 0 && (
              <p className="mt-1 text-[11px] text-ink-faint">{bookingNotes(b).join(" · ")}</p>
            )}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl bg-surface shadow-sm ring-1 ring-black/5 sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 font-medium">Room</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {bookings?.map((b) => (
              <tr
                key={b.id}
                onClick={() => setOpenId(b.id)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-bg"
              >
                <td className="px-4 py-3 font-medium text-ink">
                  {b.guestName}
                  {b.groupName && <span className="ml-1.5 text-xs text-ink-faint">{b.groupName}</span>}
                  {bookingNotes(b).length > 0 && (
                    <p className="mt-0.5 text-[11px] font-normal text-ink-faint">
                      {bookingNotes(b).join(" · ")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-soft">{b.roomName}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">
                  {b.complimentary ? "—" : formatCurrency(b.totals.netTotal)}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right tabular-nums",
                    b.totals.balance > 0 && !b.complimentary
                      ? "font-medium text-danger"
                      : "text-ink-faint",
                  )}
                >
                  {b.complimentary ? "—" : formatCurrency(b.totals.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BookingDetail
        key={openId}
        bookingId={openId}
        open={openId !== null}
        onClose={() => setOpenId(null)}
        onChanged={refetch}
      />
    </div>
  );
}
