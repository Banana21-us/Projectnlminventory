"use client";

import { CalendarClock, PackagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ShelfTag } from "@/components/shelf-tag";
import { StatusBadge, StockCount, StockGauge } from "@/components/stock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABELS, WRITE_OFF_LABELS, WRITE_OFF_REASONS, daysUntil } from "@/lib/types";
import type { BatchInfo, Item, UnitStatus } from "@/lib/types";

const UNIT_BADGES: Record<UnitStatus, { label: string; variant: "success" | "warning" | "neutral" }> = {
  IN_STOCK: { label: "In stock", variant: "success" },
  ISSUED: { label: "Issued", variant: "warning" },
  WRITTEN_OFF: { label: "Written off", variant: "neutral" },
};

export function ItemDetailSheet({
  item,
  onClose,
  onChanged,
  canManage,
}: {
  item: Item | null;
  onClose: () => void;
  onChanged: () => void;
  canManage: boolean;
}) {
  const [panel, setPanel] = useState<"receive" | "writeoff" | null>(null);

  const close = () => {
    setPanel(null);
    onClose();
  };

  return (
    <Sheet open={!!item} onClose={close} side="right" title={item?.name}>
      {item && (
        <div className="space-y-5">
          <div className="space-y-2">
            {item.model && (
              <p className="text-sm text-ink-soft">
                Model: <span className="font-medium text-ink">{item.model}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <ShelfTag code={item.shelf} />
              <span className="text-xs text-ink-faint">
                {CATEGORY_LABELS[item.category]} · {item.location}
              </span>
              <StatusBadge item={item} />
              {item.serialized && <Badge variant="brand">Serial-tracked</Badge>}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <StockGauge item={item} className="flex-1" />
              <StockCount item={item} />
            </div>
          </div>

          {canManage && (
            <div className="flex gap-2">
              <Button
                variant={panel === "receive" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setPanel(panel === "receive" ? null : "receive")}
              >
                <PackagePlus className="h-4 w-4" /> Receive stock
              </Button>
              <Button
                variant={panel === "writeoff" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                disabled={item.stock === 0 && panel !== "writeoff"}
                onClick={() => setPanel(panel === "writeoff" ? null : "writeoff")}
              >
                <Trash2 className="h-4 w-4" /> Write off
              </Button>
            </div>
          )}

          {panel === "receive" && (
            <ReceiveForm item={item} onDone={() => { setPanel(null); onChanged(); }} />
          )}
          {panel === "writeoff" && (
            <WriteOffForm item={item} onDone={() => { setPanel(null); onChanged(); }} />
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Batches · draw order
            </h3>
            {item.batches.length === 0 ? (
              <p className="rounded-lg bg-bg px-3 py-4 text-center text-[13px] text-ink-faint">
                No stock received yet.
              </p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-xl ring-1 ring-black/5">
                {item.batches.map((b) => (
                  <BatchRow key={b.id} batch={b} unit={item.unit} />
                ))}
              </ul>
            )}
          </section>

          {item.serialized && item.units && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Serial numbers
              </h3>
              <ul className="space-y-1.5">
                {item.units.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between rounded-lg bg-bg px-3 py-2"
                  >
                    <span className="font-mono text-xs font-semibold text-ink">{u.serial}</span>
                    <Badge variant={UNIT_BADGES[u.status].variant}>
                      {UNIT_BADGES[u.status].label}
                    </Badge>
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

function BatchRow({ batch, unit }: { batch: BatchInfo; unit: string }) {
  const days = batch.expiry ? daysUntil(batch.expiry) : null;
  return (
    <li className="bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs font-semibold text-ink">{batch.code}</span>
        <span className="shrink-0 font-mono text-xs text-ink-soft">
          {batch.qtyOnHand}/{batch.qtyReceived} {unit}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
        <span>Received {new Date(batch.receivedAt).toLocaleDateString()}</span>
        {batch.expiry &&
          (days !== null && days < 0 ? (
            <Badge variant="danger">
              <CalendarClock className="h-3 w-3" /> Expired
            </Badge>
          ) : days !== null && days <= 45 ? (
            <Badge variant="warning">
              <CalendarClock className="h-3 w-3" /> {days} d left
            </Badge>
          ) : (
            <span className="font-mono">EXP {batch.expiry}</span>
          ))}
        {batch.note && <span>· {batch.note}</span>}
      </div>
    </li>
  );
}

function ReceiveForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const serials = String(fd.get("serials") ?? "")
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "RECEIVE",
          stockId: item.id,
          qty: item.serialized ? undefined : Number(fd.get("qty")),
          unitCost: Number(fd.get("unitCost")) || undefined,
          batchCode: fd.get("batchCode") || undefined,
          expiry: fd.get("expiry") || undefined,
          serials: item.serialized ? serials : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not receive stock");
      }
      toast({ kind: "success", title: "Stock received" });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not receive stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-bg p-4 ring-1 ring-black/5">
      {item.serialized ? (
        <MiniField label="Serial numbers (one per line)">
          <textarea
            name="serials"
            required
            rows={3}
            placeholder={"SN-1001\nSN-1002"}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </MiniField>
      ) : (
        <MiniField label={`Quantity (${item.unit})`}>
          <Input name="qty" type="number" min={1} required className="font-mono" />
        </MiniField>
      )}
      <div className="grid grid-cols-2 gap-3">
        <MiniField label="Batch / lot code (optional)">
          <Input name="batchCode" placeholder="auto" className="font-mono" />
        </MiniField>
        <MiniField label="Expiry (optional)">
          <Input name="expiry" type="date" className="font-mono" />
        </MiniField>
      </div>
      <MiniField label={`Unit cost — ₱ (optional, updates average cost)`}>
        <Input name="unitCost" type="number" min={0} step="0.01" className="font-mono" />
      </MiniField>
      {error && <FormError message={error} />}
      <Button type="submit" size="sm" className="w-full" disabled={saving}>
        {saving ? "Saving…" : "Receive as new batch"}
      </Button>
    </form>
  );
}

function WriteOffForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());

  const inStockUnits = (item.units ?? []).filter((u) => u.status === "IN_STOCK");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (item.serialized && selectedUnits.size === 0) {
      setError("Select at least one serial to write off.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "WRITE_OFF",
          stockId: item.id,
          qty: item.serialized ? undefined : Number(fd.get("qty")),
          batchId: fd.get("batchId") || undefined,
          unitIds: item.serialized ? [...selectedUnits] : undefined,
          writeOffReason: fd.get("writeOffReason"),
          note: fd.get("note") || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Write-off failed");
      }
      toast({ kind: "success", title: "Stock written off" });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Write-off failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-bg p-4 ring-1 ring-black/5">
      {item.serialized ? (
        <MiniField label="Serials to write off">
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {inStockUnits.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg bg-surface px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={selectedUnits.has(u.id)}
                  onChange={() =>
                    setSelectedUnits((s) => {
                      const next = new Set(s);
                      if (next.has(u.id)) next.delete(u.id);
                      else next.add(u.id);
                      return next;
                    })
                  }
                  className="h-4 w-4 accent-brand"
                />
                <span className="font-mono text-xs font-semibold text-ink">{u.serial}</span>
              </label>
            ))}
          </div>
        </MiniField>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <MiniField label={`Quantity (${item.unit})`}>
            <Input name="qty" type="number" min={1} max={item.stock} required className="font-mono" />
          </MiniField>
          <MiniField label="From batch">
            <select
              name="batchId"
              className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
            >
              <option value="">Auto (draw order)</option>
              {item.batches
                .filter((b) => b.qtyOnHand > 0)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.qtyOnHand} on hand
                  </option>
                ))}
            </select>
          </MiniField>
        </div>
      )}
      <MiniField label="Reason">
        <select
          name="writeOffReason"
          required
          className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        >
          {WRITE_OFF_REASONS.map((r) => (
            <option key={r} value={r}>
              {WRITE_OFF_LABELS[r]}
            </option>
          ))}
        </select>
      </MiniField>
      <MiniField label="Note (optional)">
        <Input name="note" placeholder="e.g. roof leak over shelf C1" />
      </MiniField>
      {error && <FormError message={error} />}
      <Button type="submit" size="sm" variant="destructive" className="w-full" disabled={saving}>
        {saving ? "Saving…" : "Write off stock"}
      </Button>
    </form>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p className="rounded-lg bg-danger-tint px-3 py-2 text-[13px] font-medium text-danger">
      {message}
    </p>
  );
}
