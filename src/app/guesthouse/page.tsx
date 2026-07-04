"use client";

import { BedDouble } from "lucide-react";

// Guesthouse module home — rooms and bookings land here (build phase 5).
// The GUESTHOUSE role is locked to this section by the proxy guards.
export default function GuesthousePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Guesthouse</h1>
        <p className="mt-1 text-sm text-ink-soft">Rooms, bookings and supplies.</p>
      </div>
      <div className="flex flex-col items-center rounded-xl bg-surface/70 px-6 py-16 text-center shadow-sm ring-1 ring-black/5">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
          <BedDouble className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-ink">Booking module coming next</p>
        <p className="mt-1 max-w-sm text-sm text-ink-soft">
          Room status and reservations will be managed here. Supplies dispensed to the
          guesthouse already appear in the movement log.
        </p>
      </div>
    </div>
  );
}
