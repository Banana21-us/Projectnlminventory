"use client";

import {
  CheckCircle2,
  ClipboardList,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RecipientPicker, type RecipientSelection } from "@/components/recipient-picker";
import { ShelfTag } from "@/components/shelf-tag";
import { StockCount, StockGauge } from "@/components/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useFetch } from "@/lib/hooks";
import { useCurrentUser } from "@/lib/use-user";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type Item,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Receipt {
  lines: { name: string; shelf: string; qty: number; unit: string }[];
  issuedTo: string;
  at: Date;
}

export default function DispensePage() {
  const { data: items, loading, refetch } = useFetch<Item[]>("/api/items");
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "ALL">("ALL");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [issuedTo, setIssuedTo] = useState("");
  const [recipient, setRecipient] = useState<RecipientSelection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (category === "ALL" || i.category === category) &&
        (!q || i.name.toLowerCase().includes(q) || i.shelf.toLowerCase().includes(q)),
    );
  }, [items, search, category]);

  const frequent = useMemo(
    () => (items ?? []).filter((i) => i.frequent && i.stock > 0),
    [items],
  );

  const cartLines = useMemo(() => {
    if (!items) return [];
    return Object.entries(cart)
      .map(([id, qty]) => ({ item: items.find((i) => i.id === id), qty }))
      .filter((l): l is { item: Item; qty: number } => !!l.item && l.qty > 0);
  }, [cart, items]);

  const totalQty = cartLines.reduce((s, l) => s + l.qty, 0);

  const setQty = (id: string, qty: number, max: number) => {
    setCart((c) => {
      const next = { ...c };
      const clamped = Math.max(0, Math.min(qty, max));
      if (clamped === 0) delete next[id];
      else next[id] = clamped;
      return next;
    });
  };

  const confirm = async () => {
    if (cartLines.length === 0 || submitting) return;
    if (!issuedTo.trim()) {
      setError("Enter who this slip is issued to.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      for (const { item, qty } of cartLines) {
        const res = await fetch("/api/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "DISPENSE",
            stockId: item.id,
            qty,
            issuedTo: issuedTo.trim(),
            ...(recipient?.recipientId ? { recipientId: recipient.recipientId } : {}),
            ...(recipient?.purpose ? { purpose: recipient.purpose } : {}),
            ...(recipient?.note ? { note: recipient.note } : {}),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Dispense failed");
        }
      }
      setReceipt({
        lines: cartLines.map(({ item, qty }) => ({
          name: item.name,
          shelf: item.shelf,
          qty,
          unit: item.unit,
        })),
        issuedTo: issuedTo.trim(),
        at: new Date(),
      });
      toast({
        kind: "success",
        title: "Dispensed successfully",
        detail: `${totalQty} item${totalQty === 1 ? "" : "s"} issued to ${issuedTo.trim()}.`,
      });
      setCart({});
      setIssuedTo("");
      setRecipient(null);
      setSheetOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Dispense failed";
      setError(msg);
      toast({ kind: "error", title: "Dispense failed", detail: msg });
    } finally {
      setSubmitting(false);
      void refetch();
    }
  };

  const slip = (
    <SlipPanel
      lines={cartLines}
      issuedTo={issuedTo}
      onIssuedTo={(v) => {
        setIssuedTo(v);
        setRecipient(null);
      }}
      onBrowse={() => setPickerOpen(true)}
      onRemove={(id) => setQty(id, 0, 0)}
      onConfirm={confirm}
      onCancel={() => {
        setCart({});
        setIssuedTo("");
        setRecipient(null);
        setError(null);
        setSheetOpen(false);
      }}
      submitting={submitting}
      error={error}
    />
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Dispense</h1>
        <p className="mt-1 text-sm text-ink-soft">Build a requisition slip</p>
      </div>

      {receipt && <ReceiptCard receipt={receipt} onDismiss={() => setReceipt(null)} />}

      <div className="grid gap-6 sm:grid-cols-[3fr_2fr]">
        {/* Item browser */}
        <div className="min-w-0 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items or shelf codes…"
              className="border-transparent pl-10 shadow-sm ring-1 ring-black/5"
              aria-label="Search items"
            />
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none]">
            {(["ALL", ...CATEGORIES] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium shadow-sm transition-colors",
                  category === c
                    ? "bg-brand text-white"
                    : "bg-surface text-ink-soft ring-1 ring-black/5 hover:text-ink",
                )}
              >
                {c === "ALL" ? "All" : CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          {/* Frequent items quick access */}
          {!loading && frequent.length > 0 && !search && category === "ALL" && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ember-dark">
                <Zap className="h-3.5 w-3.5" /> Frequent
              </p>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none]">
                {frequent.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setQty(item.id, (cart[item.id] ?? 0) + 1, item.stock)}
                    className="flex shrink-0 items-center gap-2 rounded-full bg-ember-tint px-3.5 py-2 text-[13px] font-medium text-ember-dark shadow-sm transition-colors hover:bg-ember hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {item.name}
                    {cart[item.id] ? (
                      <span className="rounded-full bg-white/80 px-1.5 font-mono text-[11px] font-bold text-ember-dark">
                        {cart[item.id]}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[92px] animate-pulse rounded-xl bg-line/60" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl bg-surface/70 px-6 py-12 text-center shadow-sm ring-1 ring-black/5">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
                <Search className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-ink">No items match</p>
              <p className="mt-1 text-sm text-ink-soft">
                Try a different search or category.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  qty={cart[item.id] ?? 0}
                  onQty={(q) => setQty(item.id, q, item.stock)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Slip panel — tablet & desktop */}
        <aside className="hidden sm:block">
          <div className="sticky top-8">{slip}</div>
        </aside>
      </div>

      {/* Mobile: floating slip button + bottom sheet */}
      {totalQty > 0 && !sheetOpen && (
        <button
          onClick={() => setSheetOpen(true)}
          className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl sm:hidden"
        >
          <ShoppingBasket className="h-4 w-4" />
          View slip · {totalQty}
        </button>
      )}
      <div className="sm:hidden">
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Current slip">
          {slip}
        </Sheet>
      </div>

      <RecipientPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(sel) => {
          setIssuedTo(sel.name);
          setRecipient(sel);
        }}
      />
    </div>
  );
}

function ItemCard({
  item,
  qty,
  onQty,
}: {
  item: Item;
  qty: number;
  onQty: (qty: number) => void;
}) {
  const out = item.stock <= 0;
  return (
    <li
      className={cn(
        "rounded-xl bg-surface p-4 shadow-sm ring-1 ring-black/5",
        out && "opacity-55",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <ShelfTag code={item.shelf} />
            <span className="text-[11px] text-ink-faint">
              {CATEGORY_LABELS[item.category]} · {item.location}
            </span>
          </div>
        </div>
        <div className="shrink-0">
          {qty === 0 ? (
            <Button size="sm" disabled={out} onClick={() => onQty(1)}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          ) : (
            <div className="flex items-center gap-1 rounded-lg bg-brand-tint p-0.5 ring-1 ring-brand/25">
              <button
                onClick={() => onQty(qty - 1)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-brand-dark hover:bg-white"
                aria-label={`Decrease ${item.name}`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center font-mono text-sm font-semibold text-ink">
                {qty}
              </span>
              <button
                onClick={() => onQty(qty + 1)}
                disabled={qty >= item.stock}
                className="flex h-9 w-9 items-center justify-center rounded-md text-brand-dark hover:bg-white disabled:opacity-35"
                aria-label={`Increase ${item.name}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <StockGauge item={item} className="flex-1" />
        <StockCount item={item} />
      </div>
      {qty >= item.stock && qty > 0 && (
        <p className="mt-2 text-[11px] font-medium text-warning">
          All remaining stock is on this slip.
        </p>
      )}
    </li>
  );
}

function SlipPanel({
  lines,
  issuedTo,
  onIssuedTo,
  onBrowse,
  onRemove,
  onConfirm,
  onCancel,
  submitting,
  error,
}: {
  lines: { item: Item; qty: number }[];
  issuedTo: string;
  onIssuedTo: (v: string) => void;
  onBrowse: () => void;
  onRemove: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-xl bg-surface shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3.5">
        <ClipboardList className="h-4 w-4 text-brand-dark" />
        <h2 className="text-sm font-semibold text-ink">Current slip</h2>
        <span className="ml-auto font-mono text-xs text-ink-faint">
          {lines.length} line{lines.length === 1 ? "" : "s"}
        </span>
      </div>

      {lines.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-ink-faint">
          No items yet — add items from the list to build a slip.
        </p>
      ) : (
        <ul className="divide-y divide-line px-4">
          {lines.map(({ item, qty }) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  {item.name}{" "}
                  <span className="font-mono text-xs font-semibold text-ink-soft">
                    × {qty}
                  </span>
                </p>
                <ShelfTag code={item.shelf} className="mt-1" />
              </div>
              <button
                onClick={() => onRemove(item.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-danger-tint hover:text-danger"
                aria-label={`Remove ${item.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t border-line p-4">
        <div>
          <label
            htmlFor="issued-to"
            className="mb-1.5 block text-xs font-medium text-ink-soft"
          >
            Issued to
          </label>
          <div className="flex gap-2">
            <Input
              id="issued-to"
              value={issuedTo}
              onChange={(e) => onIssuedTo(e.target.value)}
              placeholder="Department, pastor, or guest…"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onBrowse}
              aria-label="Pick from department, pastor, or guest lists"
              title="Pick from department, pastor, or guest lists"
            >
              <UserRound className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {error && (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
        <Button
          className="w-full"
          size="lg"
          disabled={lines.length === 0 || submitting}
          onClick={onConfirm}
        >
          {submitting ? "Dispensing…" : "Confirm dispense"}
        </Button>
        {lines.length > 0 && (
          <Button variant="ghost" className="w-full" onClick={onCancel} disabled={submitting}>
            Cancel slip
          </Button>
        )}
      </div>
    </div>
  );
}

function ReceiptCard({
  receipt,
  onDismiss,
}: {
  receipt: Receipt;
  onDismiss: () => void;
}) {
  const { name: staffName } = useCurrentUser();
  return (
    <div className="animate-fade-in rounded-xl border-t-2 border-dashed border-line-strong bg-surface p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <p className="text-sm font-semibold text-ink">
            Dispensed · logged to movements
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="-m-1 rounded-md p-1 text-ink-faint hover:text-ink"
          aria-label="Dismiss receipt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-4 space-y-1.5 border-y border-dashed border-line py-3">
        {receipt.lines.map((l) => (
          <li
            key={`${l.name}-${l.shelf}`}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-ink">{l.name}</span>
              <ShelfTag code={l.shelf} />
            </span>
            <span className="shrink-0 font-mono text-xs font-semibold text-ink">
              × {l.qty} {l.unit}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 text-[13px] text-ink-soft">
        <div className="flex justify-between">
          <dt>Issued to</dt>
          <dd className="font-medium text-ink">{receipt.issuedTo}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Staff</dt>
          <dd className="font-medium text-ink">{staffName}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Time</dt>
          <dd className="font-mono text-xs text-ink">
            {receipt.at.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </dd>
        </div>
      </dl>
    </div>
  );
}
