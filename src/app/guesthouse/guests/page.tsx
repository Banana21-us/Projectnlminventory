"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { GuesthouseTabs } from "@/components/guesthouse/guesthouse-tabs";
import { GuestDetailSheet } from "@/components/guesthouse/guest-detail";
import { Input } from "@/components/ui/input";
import { useFetch } from "@/lib/hooks";
import { formatCurrency } from "@/lib/format";
import type { GuestDto } from "@/lib/types";

function formatDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function GuestsPage() {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const params = new URLSearchParams({ list: "1" });
  if (q.trim()) params.set("search", q.trim());
  const { data: guests, loading } = useFetch<GuestDto[]>(`/api/guesthouse/guests?${params.toString()}`);

  return (
    <div className="space-y-5">
      <GuesthouseTabs />
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Guests</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Repeat guests, their visit history, and any credit on file.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search guests…"
          className="pl-10"
        />
      </div>

      {loading && <p className="py-10 text-center text-sm text-ink-faint">Loading…</p>}
      {guests && guests.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-faint">No guests match.</p>
      )}

      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {guests?.map((g) => (
          <button
            key={g.id}
            onClick={() => setOpenId(g.id)}
            className="w-full rounded-xl bg-surface p-3.5 text-left shadow-sm ring-1 ring-black/5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{g.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {g.visits} visit{g.visits === 1 ? "" : "s"}
                  {g.lastStay ? ` · last ${formatDate(g.lastStay)}` : ""}
                </p>
              </div>
              {g.creditBalance > 0 && (
                <span className="shrink-0 rounded-full bg-success-tint px-2.5 py-1 text-xs font-medium text-success">
                  {formatCurrency(g.creditBalance)} credit
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl bg-surface shadow-sm ring-1 ring-black/5 sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 text-right font-medium">Visits</th>
              <th className="px-4 py-3 font-medium">Last stay</th>
              <th className="px-4 py-3 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {guests?.map((g) => (
              <tr
                key={g.id}
                onClick={() => setOpenId(g.id)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-bg"
              >
                <td className="px-4 py-3 font-medium text-ink">
                  {g.name}
                  {g.email && <p className="mt-0.5 text-[11px] font-normal text-ink-faint">{g.email}</p>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{g.visits}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {g.lastStay ? formatDate(g.lastStay) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {g.creditBalance > 0 ? (
                    <span className="font-medium text-success">{formatCurrency(g.creditBalance)}</span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GuestDetailSheet guestId={openId} open={openId !== null} onClose={() => setOpenId(null)} />
    </div>
  );
}
