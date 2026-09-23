"use client";

import { AlertTriangle, BedDouble, Check, Gift, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useFetch } from "@/lib/hooks";
import { useCurrentUser } from "@/lib/use-user";
import { formatCurrency } from "@/lib/format";
import type { RecipientDto, RoomAvailabilityDto } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "2026-09-18" for an offset from today, in the browser's local calendar. */
function dayString(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nightsBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function addDayString(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * A room's occupancy across the strip window: one cell per night, shaded
 * where it's taken. This is what replaces a full room×date calendar — it
 * prevents conflicts exactly where they happen (choosing the dates) and
 * still works at 375px.
 */
function AvailabilityStrip({
  room,
  windowStart,
  windowDays,
  checkIn,
  checkOut,
}: {
  room: RoomAvailabilityDto;
  windowStart: string;
  windowDays: number;
  checkIn: string;
  checkOut: string;
}) {
  const busy = new Set(room.busyNights);
  const cells = Array.from({ length: windowDays }, (_, i) => addDayString(windowStart, i));

  return (
    <div className="mt-2">
      <div className="flex gap-0.5">
        {cells.map((day) => {
          const isBusy = busy.has(day);
          const inRange = day >= checkIn && day < checkOut;
          return (
            <div
              key={day}
              title={`${day}${isBusy ? " — taken" : ""}`}
              className={cn(
                "h-2 flex-1 rounded-[2px]",
                isBusy ? "bg-danger/70" : inRange ? "bg-brand" : "bg-line",
              )}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-faint">
        <span>{windowStart.slice(5)}</span>
        <span>{addDayString(windowStart, windowDays - 1).slice(5)}</span>
      </div>
    </div>
  );
}

export function BookingSheet({
  open,
  onClose,
  onSaved,
  walkIn = false,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Walk-in creates, confirms and checks in in one step. */
  walkIn?: boolean;
}) {
  const toast = useToast();
  const { can } = useCurrentUser();
  const isAdmin = can("guesthouse.adjust");

  const [guestName, setGuestName] = useState("");
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [guestSuggestOpen, setGuestSuggestOpen] = useState(false);
  const [contact, setContact] = useState("");
  const [checkIn, setCheckIn] = useState(dayString());
  const [checkOut, setCheckOut] = useState(dayString(1));
  const [occupants, setOccupants] = useState(1);
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [note, setNote] = useState("");
  const [tentative, setTentative] = useState(false);
  const [holdUntil, setHoldUntil] = useState("");
  const [complimentary, setComplimentary] = useState(false);
  const [compReason, setCompReason] = useState("");
  const [rateOverride, setRateOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nights = nightsBetween(checkIn, checkOut);
  const validRange = nights >= 1;

  // Strip window: a few days either side of the stay, so the guest can see
  // what's around their dates without another screen.
  const windowStart = addDayString(checkIn, -2);
  const windowDays = Math.min(21, Math.max(10, nights + 6));
  const windowEnd = addDayString(windowStart, windowDays);

  const { data: rooms, loading } = useFetch<RoomAvailabilityDto[]>(
    open && validRange ? `/api/guesthouse/rooms?from=${windowStart}&to=${windowEnd}` : "",
  );

  // Repeat-guest suggestions — picking one links the booking to that
  // guest's Recipient record, which is what the credit-balance feature
  // hangs off. Typing a name that matches no one is fine too: submit()
  // find-or-creates it, so it's suggested automatically next time.
  const guestQuery = guestName.trim();
  const { data: guestSuggestions } = useFetch<RecipientDto[]>(
    guestSuggestOpen && guestQuery.length >= 2
      ? `/api/guesthouse/guests?search=${encodeURIComponent(guestQuery)}`
      : "",
  );

  // Free-for-these-dates is computed from the strip data, so the list and
  // the bars can never disagree.
  const withFit = useMemo(() => {
    if (!rooms) return [];
    return rooms.map((r) => {
      const stayNights = Array.from({ length: nights }, (_, i) => addDayString(checkIn, i));
      const clash = stayNights.filter((d) => r.busyNights.includes(d));
      return { ...r, fits: clash.length === 0 && !r.outOfService, clashNights: clash };
    });
  }, [rooms, checkIn, nights]);

  const selected = withFit.filter((r) => roomIds.includes(r.id));
  const total = selected.reduce(
    (sum, r) => sum + (rateOverride !== "" ? Number(rateOverride) : r.rate) * nights,
    0,
  );

  function toggleRoom(id: string, fits: boolean) {
    if (!fits) return;
    setRoomIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setError(null);
    if (!guestName.trim()) return setError("Guest name is required");
    if (!validRange) return setError("Check-out must be at least one night after check-in");
    if (!roomIds.length) return setError("Pick at least one room");
    if (complimentary && !compReason.trim()) return setError("A complimentary stay needs a reason");

    setSaving(true);
    try {
      // Link (or silently create) the guest's Recipient record so repeat
      // visits show up as suggestions and can accrue/spend credit.
      let linkedRecipientId = recipientId;
      if (!linkedRecipientId) {
        const guestRes = await fetch("/api/guesthouse/guests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: guestName.trim() }),
        });
        const guestJson = await guestRes.json().catch(() => null);
        if (guestRes.ok) linkedRecipientId = guestJson.id;
      }

      const res = await fetch("/api/guesthouse/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomIds,
          guestName: guestName.trim(),
          ...(linkedRecipientId ? { recipientId: linkedRecipientId } : {}),
          ...(contact.trim() ? { contact: contact.trim() } : {}),
          ...(roomIds.length > 1 && groupName.trim() ? { groupName: groupName.trim() } : {}),
          checkIn,
          checkOut,
          occupants,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(walkIn ? { checkInNow: true } : {}),
          ...(!walkIn && tentative ? { tentative: true } : {}),
          ...(!walkIn && tentative && holdUntil ? { holdUntil } : {}),
          ...(complimentary ? { complimentary: true, compReason: compReason.trim() } : {}),
          ...(isAdmin && rateOverride !== "" ? { rateOverride: Number(rateOverride) } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save the booking");

      toast({
        kind: "success",
        title: walkIn ? "Checked in" : roomIds.length > 1 ? "Group booked" : "Booking saved",
        detail: `${guestName.trim()} · ${roomIds.length} room${roomIds.length > 1 ? "s" : ""} · ${nights} night${nights > 1 ? "s" : ""}`,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the booking");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={walkIn ? "Walk-in" : "New booking"}>
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-ink-soft">Guest</label>
          <div className="relative">
            <Input
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                setRecipientId(null);
                setGuestSuggestOpen(true);
              }}
              onFocus={() => setGuestSuggestOpen(true)}
              onBlur={() => setTimeout(() => setGuestSuggestOpen(false), 150)}
              placeholder="Guest or group name"
              autoFocus
            />
            {guestSuggestOpen && guestSuggestions && guestSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg bg-surface shadow-lg ring-1 ring-black/5">
                {guestSuggestions.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setGuestName(g.name);
                        setRecipientId(g.id);
                        setGuestSuggestOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm font-medium text-ink hover:bg-brand-tint hover:text-brand-dark"
                    >
                      {g.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Contact number (optional)"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-ink-soft">Check in</label>
            <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">Check out</label>
            <Input
              type="date"
              value={checkOut}
              min={addDayString(checkIn, 1)}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-sm">
          <span className="text-ink-soft">
            {validRange ? `${nights} night${nights > 1 ? "s" : ""}` : "Invalid dates"}
          </span>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-faint" />
            <input
              type="number"
              min={1}
              max={20}
              value={occupants}
              onChange={(e) => setOccupants(Math.max(1, Number(e.target.value)))}
              className="w-14 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
              aria-label="Occupants"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-ink-soft">Room</label>
            {roomIds.length > 1 && (
              <span className="text-xs text-brand-dark">{roomIds.length} rooms — group booking</span>
            )}
          </div>

          {loading && <p className="py-6 text-center text-sm text-ink-faint">Checking availability…</p>}

          <div className="space-y-2">
            {withFit.map((room) => {
              const picked = roomIds.includes(room.id);
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => toggleRoom(room.id, room.fits)}
                  disabled={!room.fits}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    picked
                      ? "border-brand bg-brand-tint/40"
                      : room.fits
                        ? "border-line bg-surface hover:bg-bg"
                        : "cursor-not-allowed border-line bg-bg/60 opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      {picked ? (
                        <Check className="h-4 w-4 text-brand" />
                      ) : (
                        <BedDouble className="h-4 w-4 text-ink-faint" />
                      )}
                      {room.name}
                      {room.needsCleaning && (
                        <span className="rounded-full bg-warning-tint px-1.5 py-0.5 text-[10px] font-medium text-warning">
                          needs cleaning
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-ink-soft">{formatCurrency(room.rate)}/night</span>
                  </div>
                  <AvailabilityStrip
                    room={room}
                    windowStart={windowStart}
                    windowDays={windowDays}
                    checkIn={checkIn}
                    checkOut={checkOut}
                  />
                  <p className="mt-1 text-xs text-ink-faint">
                    {room.fits ? "Free for your dates" : (room.conflict ?? "Not available")}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {roomIds.length > 1 && (
          <div>
            <label className="text-xs font-medium text-ink-soft">Group name</label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Pastors' Council Oct"
            />
          </div>
        )}

        {!walkIn && (
          <label className="flex items-start gap-2 rounded-lg bg-bg px-3 py-2.5">
            <input
              type="checkbox"
              checked={tentative}
              onChange={(e) => setTentative(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
            />
            <span className="text-sm text-ink">
              Tentative hold
              <span className="block text-xs text-ink-faint">
                Holds the room but is not firm. Everything else is confirmed straight away.
              </span>
            </span>
          </label>
        )}

        {tentative && !walkIn && (
          <div>
            <label className="text-xs font-medium text-ink-soft">Hold until</label>
            <Input type="date" value={holdUntil} onChange={(e) => setHoldUntil(e.target.value)} />
          </div>
        )}

        {isAdmin && (
          <div className="space-y-3 rounded-lg border border-dashed border-line p-3">
            <p className="text-xs font-medium text-ink-soft">ADMIN options</p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={complimentary}
                onChange={(e) => setComplimentary(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
              />
              <span className="text-sm text-ink">
                <Gift className="mr-1 inline h-3.5 w-3.5 text-success" />
                Complimentary stay
                <span className="block text-xs text-ink-faint">
                  Bills nothing. Reported as comped nights and notional value.
                </span>
              </span>
            </label>
            {complimentary && (
              <Input
                value={compReason}
                onChange={(e) => setCompReason(e.target.value)}
                placeholder="Reason / who authorised"
              />
            )}
            {!complimentary && (
              <div>
                <label className="text-xs font-medium text-ink-soft">Rate override (per night)</label>
                <Input
                  type="number"
                  min={0}
                  value={rateOverride}
                  onChange={(e) => setRateOverride(e.target.value)}
                  placeholder="Leave blank to use the room rate"
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-ink-soft">Note</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-brand-tint/40 px-3.5 py-3">
          <span className="text-sm text-ink-soft">
            {complimentary ? "Complimentary" : "Total"}
            {selected.length > 0 && !complimentary && (
              <span className="block text-xs text-ink-faint">
                {selected.length} room{selected.length > 1 ? "s" : ""} × {nights} night
                {nights > 1 ? "s" : ""}
              </span>
            )}
          </span>
          <span className="font-display text-lg font-semibold text-ink">
            {complimentary ? formatCurrency(0) : formatCurrency(total)}
          </span>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <Button className="w-full" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : walkIn ? "Check in now" : "Save booking"}
        </Button>
      </div>
    </Sheet>
  );
}
