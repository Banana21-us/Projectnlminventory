"use client";

import { Lock, Plus, Unlock, Wrench } from "lucide-react";
import { useState } from "react";
import { GuesthouseTabs } from "@/components/guesthouse/guesthouse-tabs";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useFetch } from "@/lib/hooks";
import type { RoomDto } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROOM_TONE = {
  AVAILABLE: "bg-success-tint text-success",
  OCCUPIED: "bg-brand-tint text-brand-dark",
  MAINTENANCE: "bg-line/60 text-ink-faint",
} as const;

function NewRoomSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return setError("Room name is required");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/guesthouse/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          rate: Number(rate || 0),
          ...(capacity ? { capacity: Number(capacity) } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add the room");
      toast({ kind: "success", title: "Room added" });
      setName("");
      setRate("");
      setCapacity("");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the room");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="New room">
      <div className="space-y-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name" autoFocus />
        <Input
          type="number"
          min={0}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Nightly rate"
        />
        <Input
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Capacity (optional)"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button className="w-full" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Add room"}
        </Button>
      </div>
    </Sheet>
  );
}

function EditRoomSheet({
  room,
  onClose,
  onSaved,
  onDeleted,
}: {
  room: RoomDto | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (room && loadedFor !== room.id) {
    setName(room.name);
    setRate(String(room.rate));
    setCapacity(room.capacity ? String(room.capacity) : "");
    setNotes(room.notes ?? "");
    setLoadedFor(room.id);
    setError(null);
  }

  async function submit() {
    if (!room) return;
    if (!name.trim()) return setError("Room name is required");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/guesthouse/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          rate: Number(rate || 0),
          capacity: capacity ? Number(capacity) : null,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not update the room");
      toast({ kind: "success", title: "Room updated" });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the room");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!room) return;
    try {
      const res = await fetch(`/api/guesthouse/rooms/${room.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not delete the room");
      toast({
        kind: "success",
        title: json.deactivated ? "Room deactivated" : "Room deleted",
      });
      onDeleted();
      onClose();
    } catch (e) {
      toast({
        kind: "error",
        title: "Delete failed",
        detail: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <Sheet open={!!room} onClose={onClose} title={room ? `Edit ${room.name}` : "Edit room"}>
      <div className="space-y-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name" autoFocus />
        <Input
          type="number"
          min={0}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Nightly rate"
        />
        <Input
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Capacity (optional)"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Notes (optional)"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center gap-2">
          <Button className="flex-1" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <ConfirmDeleteButton label={room?.name ?? "room"} onConfirm={remove} />
        </div>
      </div>
    </Sheet>
  );
}

function BlockSheet({
  room,
  onClose,
  onSaved,
}: {
  room: RoomDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function submit() {
    if (!room) return;
    if (!fromDate || !toDate) return setError("Pick both dates");
    if (!reason.trim()) return setError("A reason is required");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/guesthouse/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, fromDate, toDate, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not block the room");
      if (json.affected?.length > 0) {
        setWarning(
          `${json.affected.length} booking(s) fall in this range and were not moved automatically — check them from Bookings.`,
        );
      }
      toast({ kind: "success", title: "Room blocked" });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not block the room");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!room} onClose={onClose} title={room ? `Block ${room.name}` : "Block room"}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
        {warning && (
          <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">{warning}</p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button className="w-full" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Block dates"}
        </Button>
      </div>
    </Sheet>
  );
}

export default function RoomsAdminPage() {
  const { data: rooms, loading, refetch } = useFetch<RoomDto[]>("/api/guesthouse/rooms");
  const { data: settings, refetch: refetchSettings } = useFetch<{
    lockedThrough: string | null;
    lockedBy: string | null;
  }>("/api/guesthouse/settings");
  const toast = useToast();

  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [blockRoom, setBlockRoom] = useState<RoomDto | null>(null);
  const [editRoom, setEditRoom] = useState<RoomDto | null>(null);
  const [lockDate, setLockDate] = useState("");

  async function saveRoom(room: RoomDto, patch: Partial<{ rate: number; outOfService: boolean }>) {
    await fetch(`/api/guesthouse/rooms/${room.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refetch();
  }

  async function setLock(date: string | null) {
    const res = await fetch("/api/guesthouse/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockedThrough: date }),
    });
    if (res.ok) {
      toast({ kind: "success", title: date ? `Locked through ${date}` : "Period unlocked" });
      refetchSettings();
    }
  }

  return (
    <div className="space-y-6">
      <GuesthouseTabs />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Rooms</h1>
          <p className="mt-1 text-sm text-ink-soft">Rates, setup, and maintenance blocks.</p>
        </div>
        <Button size="sm" onClick={() => setNewRoomOpen(true)}>
          <Plus className="h-4 w-4" /> New room
        </Button>
      </div>

      {loading && <p className="py-10 text-center text-sm text-ink-faint">Loading…</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms?.map((room) => (
          <div key={room.id} className="rounded-xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
            <button
              onClick={() => setEditRoom(room)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="font-semibold text-ink">{room.name}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", ROOM_TONE[room.status])}>
                {room.status === "AVAILABLE" ? "Free" : room.status === "OCCUPIED" ? "Occupied" : "Out of service"}
              </span>
            </button>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-ink-soft">Rate</span>
              <input
                type="number"
                min={0}
                defaultValue={room.rate}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== room.rate) saveRoom(room, { rate: v });
                }}
                className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
              />
              <span className="text-xs text-ink-faint">/night</span>
            </div>
            {room.blocks && room.blocks.length > 0 && (
              <ul className="mt-2 space-y-1">
                {room.blocks.map((b) => (
                  <li key={b.id} className="flex items-center gap-1.5 text-xs text-warning">
                    <Wrench className="h-3 w-3" />
                    {b.from} – {b.to} · {b.reason}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setBlockRoom(room)}>
                Block dates
              </Button>
              <Button
                variant={room.outOfService ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => saveRoom(room, { outOfService: !room.outOfService })}
              >
                {room.outOfService ? "Reopen" : "Close indefinitely"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          {settings?.lockedThrough ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          Period lock
        </h2>
        <p className="mb-3 text-xs text-ink-soft">
          {settings?.lockedThrough
            ? `Closed through ${settings.lockedThrough}${settings.lockedBy ? ` by ${settings.lockedBy}` : ""}. Stays and payments on or before this date can't be edited.`
            : "Nothing is closed yet — every stay and payment can still be edited."}
        </p>
        <div className="flex gap-2">
          <Input type="date" value={lockDate} onChange={(e) => setLockDate(e.target.value)} />
          <Button onClick={() => setLock(lockDate)} disabled={!lockDate}>
            Close through
          </Button>
          {settings?.lockedThrough && (
            <Button variant="outline" onClick={() => setLock(null)}>
              Unlock
            </Button>
          )}
        </div>
      </section>

      <NewRoomSheet open={newRoomOpen} onClose={() => setNewRoomOpen(false)} onSaved={refetch} />
      <BlockSheet room={blockRoom} onClose={() => setBlockRoom(null)} onSaved={refetch} />
      <EditRoomSheet
        room={editRoom}
        onClose={() => setEditRoom(null)}
        onSaved={refetch}
        onDeleted={refetch}
      />
    </div>
  );
}
