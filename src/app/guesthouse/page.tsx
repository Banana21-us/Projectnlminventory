"use client";

import {
  BedDouble,
  BrushCleaning,
  DoorOpen,
  LogIn,
  Plus,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { GuesthouseTabs } from "@/components/guesthouse/guesthouse-tabs";
import { BookingDetail } from "@/components/guesthouse/booking-detail";
import { BookingSheet } from "@/components/guesthouse/booking-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useFetch } from "@/lib/hooks";
import { useCurrentUser } from "@/lib/use-user";
import { formatCurrency } from "@/lib/format";
import { bookingNotes } from "@/lib/booking-ui";
import { BOOKING_STATUS_LABELS, type Booking, type RoomDto, type TodayBoard } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function RoomDetailSheet({ room, onClose }: { room: RoomDto | null; onClose: () => void }) {
  return (
    <Sheet open={!!room} onClose={onClose} title={room?.name ?? "Room"}>
      {room && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-soft">Status</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                ROOM_TONE[room.status],
              )}
            >
              {room.status === "AVAILABLE"
                ? "Free"
                : room.status === "OCCUPIED"
                  ? "Occupied"
                  : "Out of service"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-soft">Rate</span>
            <span className="text-sm font-medium text-ink">{formatCurrency(room.rate)}/night</span>
          </div>
          {room.capacity !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-soft">Capacity</span>
              <span className="text-sm font-medium text-ink">{room.capacity}</span>
            </div>
          )}
          {room.guestName && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-soft">Guest</span>
              <span className="text-sm font-medium text-ink">
                {room.guestName}
                {room.until ? ` · until ${formatDate(room.until)}` : ""}
              </span>
            </div>
          )}
          {room.blocks && room.blocks.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm text-ink-soft">Blocked</p>
              <ul className="space-y-1">
                {room.blocks.map((b) => (
                  <li key={b.id} className="text-xs text-warning">
                    {formatDate(b.from)} – {formatDate(b.to)} · {b.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-1.5 text-sm text-ink-soft">Notes</p>
            <p className="whitespace-pre-wrap rounded-lg bg-line/30 p-3 text-sm text-ink">
              {room.notes || "No notes for this room."}
            </p>
          </div>
        </div>
      )}
    </Sheet>
  );
}

const ROOM_TONE = {
  AVAILABLE: "bg-success-tint text-success",
  OCCUPIED: "bg-brand-tint text-brand-dark",
  MAINTENANCE: "bg-line/60 text-ink-faint",
} as const;

function BookingCard({
  booking,
  onOpen,
  primary,
}: {
  booking: Booking;
  onOpen: () => void;
  primary?: { label: string; onClick: () => void; tone?: "default" | "accent" };
}) {
  const unpaid = booking.totals.balance > 0 && !booking.complimentary;
  const notes = bookingNotes(booking);
  return (
    <div className="rounded-xl bg-surface p-3.5 shadow-sm ring-1 ring-black/5">
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{booking.guestName}</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {booking.billedNights} night{booking.billedNights > 1 ? "s" : ""} ·{" "}
              {booking.complimentary ? "Complimentary" : formatCurrency(booking.totals.netTotal)}
              {booking.groupName ? ` · ${booking.groupName}` : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-medium text-ink">{booking.roomName}</p>
            <Badge
              variant={
                booking.status === "PENDING"
                  ? "warning"
                  : booking.status === "CHECKED_IN"
                    ? "success"
                    : "brand"
              }
              className="mt-1"
            >
              {BOOKING_STATUS_LABELS[booking.status]}
            </Badge>
          </div>
        </div>
      </button>
      {notes.length > 0 && (
        <p className="mt-1.5 text-[11px] text-ink-faint">{notes.join(" · ")}</p>
      )}
      {unpaid && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
          <TriangleAlert className="h-3.5 w-3.5" />
          Balance due {formatCurrency(booking.totals.balance)}
        </p>
      )}
      {primary && (
        <Button
          size="sm"
          variant={primary.tone === "accent" ? "accent" : "default"}
          className="mt-2.5 w-full"
          onClick={primary.onClick}
        >
          {primary.label}
        </Button>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {title} · {count}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function GuesthousePage() {
  const { data, loading, refetch } = useFetch<TodayBoard>("/api/guesthouse/today");
  const toast = useToast();
  const { can } = useCurrentUser();
  const isAdmin = can("guesthouse.adjust");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [walkIn, setWalkIn] = useState(false);
  // Bumped each time the sheet opens so BookingSheet remounts with a clean
  // slate instead of carrying over the previous session's form state.
  const [sheetSession, setSheetSession] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewRoom, setViewRoom] = useState<RoomDto | null>(null);

  async function quickAction(id: string, body: unknown, title: string) {
    const res = await fetch(`/api/guesthouse/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      toast({ kind: "error", title: json.error ?? "That did not work" });
      return;
    }
    toast({ kind: "success", title });
    refetch();
  }

  async function markClean(room: RoomDto) {
    await fetch(`/api/guesthouse/rooms/${room.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ needsCleaning: false }),
    });
    refetch();
  }

  const today = data
    ? new Date(`${data.date}T00:00:00Z`).toLocaleDateString("en-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "";

  return (
    <div className="space-y-5 pb-24">
      <GuesthouseTabs />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Guesthouse</h1>
          <p className="mt-1 text-sm text-ink-soft">{today}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setWalkIn(true);
            setSheetSession((s) => s + 1);
            setSheetOpen(true);
          }}
        >
          <Zap className="h-4 w-4" /> Walk-in
        </Button>
      </div>

      {loading && <p className="py-10 text-center text-sm text-ink-faint">Loading the board…</p>}

      {data && (
        <>
          {/* ── Counters ── */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Arrivals", value: data.counts.arrivals, icon: LogIn },
              { label: "Departures", value: data.counts.departures, icon: DoorOpen },
              { label: "In-house", value: data.counts.inHouse, icon: BedDouble },
              { label: "Free", value: data.counts.free, icon: BedDouble },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-xl bg-surface p-3 text-center shadow-sm ring-1 ring-black/5"
              >
                <p className="font-display text-xl font-bold text-ink">{c.value}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">{c.label}</p>
              </div>
            ))}
          </div>

          {data.counts.needsCleaning > 0 && (
            <p className="flex items-center gap-2 rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
              <BrushCleaning className="h-4 w-4" />
              {data.counts.needsCleaning} room{data.counts.needsCleaning > 1 ? "s" : ""} need
              cleaning
            </p>
          )}

          <Section title="Did not arrive" count={data.didNotArrive.length}>
            {data.didNotArrive.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onOpen={() => setOpenId(b.id)}
                primary={{
                  label: "Mark no-show",
                  onClick: () => quickAction(b.id, { action: "noShow" }, "Marked as no-show"),
                }}
              />
            ))}
          </Section>

          <Section title="Expired holds" count={data.expiredHolds.length}>
            {data.expiredHolds.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onOpen={() => setOpenId(b.id)}
                primary={{
                  label: "Confirm",
                  onClick: () => quickAction(b.id, { action: "confirm" }, "Confirmed"),
                }}
              />
            ))}
          </Section>

          <Section title="Arrivals" count={data.arrivals.length}>
            {data.arrivals.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onOpen={() => setOpenId(b.id)}
                primary={{
                  label: "Check in",
                  onClick: () => quickAction(b.id, { action: "checkIn" }, "Checked in"),
                }}
              />
            ))}
          </Section>

          <Section title="Departures" count={data.departures.length}>
            {data.departures.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onOpen={() => setOpenId(b.id)}
                primary={{
                  // Unpaid departures route through the folio for an ADMIN
                  // to settle first — front desk never touches cash, so
                  // they just check out and the balance stays outstanding
                  // until an ADMIN records the payment separately.
                  label:
                    isAdmin && b.totals.balance > 0 && !b.complimentary
                      ? "Settle & check out"
                      : "Check out",
                  tone: isAdmin && b.totals.balance > 0 && !b.complimentary ? "accent" : "default",
                  onClick: () =>
                    isAdmin && b.totals.balance > 0 && !b.complimentary
                      ? setOpenId(b.id)
                      : quickAction(b.id, { action: "checkOut" }, "Checked out"),
                }}
              />
            ))}
          </Section>

          <Section title="In-house" count={data.inHouse.length}>
            {data.inHouse.map((b) => (
              <BookingCard key={b.id} booking={b} onOpen={() => setOpenId(b.id)} />
            ))}
          </Section>

          {/* ── Rooms ── */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Rooms
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {data.rooms.map((room) => (
                <div
                  key={room.id}
                  className="rounded-xl bg-surface p-3 shadow-sm ring-1 ring-black/5"
                >
                  <button onClick={() => setViewRoom(room)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{room.name}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          ROOM_TONE[room.status],
                        )}
                      >
                        {room.status === "AVAILABLE"
                          ? "Free"
                          : room.status === "OCCUPIED"
                            ? "Occupied"
                            : "Out of service"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-soft">
                      {room.guestName ?? `${formatCurrency(room.rate)}/night`}
                    </p>
                  </button>
                  {room.needsCleaning && (
                    <button
                      onClick={() => markClean(room)}
                      className="mt-1.5 w-full rounded-md bg-warning-tint px-2 py-1 text-[11px] font-medium text-warning"
                    >
                      Mark clean
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── New booking ── */}
      <button
        onClick={() => {
          setWalkIn(false);
          setSheetSession((s) => s + 1);
          setSheetOpen(true);
        }}
        className="fixed bottom-24 right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-brand-dark sm:bottom-8"
      >
        <Plus className="h-5 w-5" /> New booking
      </button>

      <BookingSheet
        key={sheetSession}
        open={sheetOpen}
        walkIn={walkIn}
        onClose={() => setSheetOpen(false)}
        onSaved={refetch}
      />
      <BookingDetail
        key={openId}
        bookingId={openId}
        open={openId !== null}
        onClose={() => setOpenId(null)}
        onChanged={refetch}
      />
      <RoomDetailSheet room={viewRoom} onClose={() => setViewRoom(null)} />
    </div>
  );
}
