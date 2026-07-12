"use client";

import {
  ArrowRightLeft,
  CheckSquare,
  ClipboardList,
  LayoutGrid,
  List,
  Plus,
  Search,
  Settings,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { InventorySettingsSheet } from "@/components/inventory-settings";
import { ItemDetailSheet } from "@/components/item-detail";
import { ShelfTag } from "@/components/shelf-tag";
import { StatusBadge, StockCount, StockGauge } from "@/components/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useFetch } from "@/lib/hooks";
import { useCurrentUser } from "@/lib/use-user";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  WRITE_OFF_LABELS,
  WRITE_OFF_REASONS,
  stockStatus,
  type Category,
  type CategoryDto,
  type Item,
  type StockroomDto,
  type WriteOffReason,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type StatusFilter = "ALL" | "low" | "critical";
type View = "grid" | "list";

export default function InventoryPage() {
  const { data: items, loading, refetch } = useFetch<Item[]>("/api/items");
  const {
    data: stockrooms,
    refetch: refetchStockrooms,
  } = useFetch<StockroomDto[]>("/api/stockrooms");
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [category, setCategory] = useState<Category | "ALL">("ALL");
  const [location, setLocation] = useState<string>("ALL");
  const [view, setView] = useState<View>("grid");
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { can } = useCurrentUser();
  const canManage = can("inventory.manage");
  const canManageSettings = can("settings.manage");
  const detailItem = useMemo(
    () => (detailId ? (items?.find((i) => i.id === detailId) ?? null) : null),
    [items, detailId],
  );

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (category !== "ALL" && i.category !== category) return false;
      if (location !== "ALL" && i.location !== location) return false;
      if (status !== "ALL" && stockStatus(i) !== status) {
        return false;
      }
      return !q || i.name.toLowerCase().includes(q) || i.shelf.toLowerCase().includes(q);
    });
  }, [items, search, status, category, location]);

  const warnings = useMemo(() => {
    if (!items) return { low: 0 };
    return {
      low: items.filter((i) => stockStatus(i) !== "ok").length,
    };
  }, [items]);

  const toggleSelected = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const bulk = async (payload: Record<string, unknown>, successTitle: string) => {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], ...payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Bulk action failed");
      }
      toast({
        kind: "success",
        title: successTitle,
        detail: `${selected.size} item${selected.size === 1 ? "" : "s"} updated.`,
      });
      exitSelectMode();
      await refetch();
    } catch (e) {
      toast({
        kind: "error",
        title: "Action failed",
        detail: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Inventory</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {items
              ? `${items.length} stock rows across ${stockrooms?.length ?? "…"} stockrooms`
              : "Loading stock…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/inventory/count-sheet"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-surface px-3 text-[13px] font-medium text-ink shadow-sm ring-1 ring-black/10 transition-colors hover:bg-bg"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Count sheet</span>
          </Link>
          {canManageSettings && (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Manage</span>
            </Button>
          )}
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            >
              <CheckSquare className="h-4 w-4" />
              {selectMode ? "Done" : "Select"}
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setAddOpen(true)} size="sm" className="hidden sm:inline-flex">
              <Plus className="h-4 w-4" /> Add item
            </Button>
          )}
        </div>
      </div>

      {/* Warnings surfaced up front */}
      {!loading && warnings.low > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatus(status === "low" ? "ALL" : "low")}
            className="flex items-center gap-2 rounded-xl bg-warning-tint px-3.5 py-2.5 text-[13px] font-medium text-warning shadow-sm"
          >
            <TriangleAlert className="h-4 w-4" />
            {warnings.low} item{warnings.low === 1 ? "" : "s"} low or out of stock
          </button>
        </div>
      )}

      {/* Search + view toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items or shelf codes…"
            className="border-transparent pl-10 shadow-sm ring-1 ring-black/5"
            aria-label="Search inventory"
          />
        </div>
        <div className="flex shrink-0 rounded-lg bg-surface p-0.5 shadow-sm ring-1 ring-black/5">
          {(
            [
              ["grid", LayoutGrid, "Grid view"],
              ["list", List, "List view"],
            ] as const
          ).map(([v, Icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-label={label}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                view === v ? "bg-brand-tint text-brand-dark" : "text-ink-faint hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Filter chips — sticky on mobile */}
      <div className="sticky top-[57px] z-20 -mx-4 bg-bg/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap [scrollbar-width:none]">
          {(
            [
              ["ALL", "All stock"],
              ["low", "Low"],
              ["critical", "Critical"],
            ] as const
          ).map(([value, label]) => (
            <Chip key={value} active={status === value} onClick={() => setStatus(value)}>
              {label}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 self-stretch bg-line-strong/60" aria-hidden />
          {(["ALL", ...CATEGORIES] as const).map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c === "ALL" ? "All categories" : CATEGORY_LABELS[c]}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 self-stretch bg-line-strong/60" aria-hidden />
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            aria-label="Filter by stockroom"
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium shadow-sm transition-colors focus:outline-none",
              location === "ALL"
                ? "bg-surface text-ink-soft ring-1 ring-black/5"
                : "bg-brand text-white",
            )}
          >
            <option value="ALL">All stockrooms</option>
            {(stockrooms ?? []).map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[128px] animate-pulse rounded-xl bg-line/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl bg-surface/70 px-6 py-14 text-center shadow-sm ring-1 ring-black/5">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
            <Search className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-ink">Nothing matches</p>
          <p className="mt-1 max-w-xs text-sm text-ink-soft">
            Try clearing the filters or searching for a different item.
          </p>
        </div>
      ) : view === "grid" ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <GridCard
              key={item.id}
              item={item}
              selectable={selectMode}
              selected={selected.has(item.id)}
              onToggle={() => toggleSelected(item.id)}
              onOpen={() => setDetailId(item.id)}
            />
          ))}
        </ul>
      ) : (
        <ListView
          items={filtered}
          selectable={selectMode}
          selected={selected}
          onToggle={toggleSelected}
          onOpen={(id) => setDetailId(id)}
        />
      )}

      {canManage && !selectMode && (
        <div className="sm:hidden">
          <Button className="w-full" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add item
          </Button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && (
        <BulkBar
          count={selected.size}
          busy={busy}
          stockrooms={stockrooms ?? []}
          onAdjust={(delta) => bulk({ action: "adjust", delta }, "Stock adjusted")}
          onTransfer={(id) => bulk({ action: "transfer", stockroomId: id }, "Items transferred")}
          onWriteOff={(reason) =>
            bulk({ action: "writeOff", writeOffReason: reason }, "Stock written off")
          }
          onClose={exitSelectMode}
        />
      )}

      <AddItemSheet
        open={addOpen}
        stockrooms={stockrooms ?? []}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          toast({ kind: "success", title: "Item added" });
          void refetch();
        }}
      />

      <InventorySettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChanged={() => {
          void refetchStockrooms();
          void refetch();
        }}
      />

      <ItemDetailSheet
        item={detailItem}
        onClose={() => setDetailId(null)}
        onChanged={() => void refetch()}
        canManage={canManage}
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium shadow-sm transition-colors",
        active
          ? "bg-brand text-white"
          : "bg-surface text-ink-soft ring-1 ring-black/5 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function SelectDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        selected ? "border-brand bg-brand" : "border-line-strong bg-surface",
      )}
    >
      {selected && <span className="h-2 w-2 rounded-full bg-white" />}
    </span>
  );
}

function GridCard({
  item,
  selectable,
  selected,
  onToggle,
  onOpen,
}: {
  item: Item;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {selectable && <SelectDot selected={selected} />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
            {item.model && (
              <p className="truncate text-[11px] text-ink-faint">{item.model}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ShelfTag code={item.shelf} />
              <span className="text-[11px] text-ink-faint">
                {CATEGORY_LABELS[item.category]} · {item.location}
              </span>
            </div>
          </div>
        </div>
        <StatusBadge item={item} />
      </div>
      <div className="mt-3.5 flex items-center gap-3">
        <StockGauge item={item} className="flex-1" />
        <StockCount item={item} />
      </div>
      {(item.batches.length > 1 || item.serialized) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {item.batches.length > 1 && (
            <span className="text-[11px] text-ink-faint">{item.batches.length} batches</span>
          )}
          {item.serialized && (
            <span className="rounded bg-brand-tint px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-dark">
              SN
            </span>
          )}
        </div>
      )}
    </>
  );

  return (
    <li>
      <button
        onClick={selectable ? onToggle : onOpen}
        className={cn(
          "w-full rounded-xl bg-surface p-4 text-left shadow-sm ring-1 transition-shadow",
          selectable && selected ? "ring-2 ring-brand" : "ring-black/5",
          !selectable && "hover:shadow-md",
        )}
      >
        {body}
      </button>
    </li>
  );
}

function ListView({
  items,
  selectable,
  selected,
  onToggle,
  onOpen,
}: {
  items: Item[];
  selectable: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-black/5">
      {/* Dense table on sm+ */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-ink-faint">
              {selectable && <th className="w-10 px-4 py-3" />}
              <th className="px-4 py-3">Item</th>
              <th className="px-3 py-3">Shelf</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3">Location</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => (selectable ? onToggle(item.id) : onOpen(item.id))}
                className={cn(
                  "cursor-pointer",
                  selectable && selected.has(item.id) ? "bg-brand-tint/60" : "hover:bg-bg/60",
                )}
              >
                {selectable && (
                  <td className="px-4 py-3">
                    <SelectDot selected={selected.has(item.id)} />
                  </td>
                )}
                <td className="px-4 py-3">
                  <span className="font-medium text-ink">{item.name}</span>
                  {item.model && (
                    <span className="block text-[11px] text-ink-faint">{item.model}</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <ShelfTag code={item.shelf} />
                </td>
                <td className="px-3 py-3 text-ink-soft">{CATEGORY_LABELS[item.category]}</td>
                <td className="px-3 py-3 text-ink-soft">{item.location}</td>
                <td className="px-3 py-3">
                  <StatusBadge item={item} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex w-36 items-center gap-2">
                    <StockGauge item={item} className="flex-1" />
                    <StockCount item={item} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Compact rows on mobile */}
      <ul className="divide-y divide-line sm:hidden">
        {items.map((item) => (
          <li
            key={item.id}
            onClick={() => (selectable ? onToggle(item.id) : onOpen(item.id))}
            className={cn(
              "flex cursor-pointer items-center gap-3 px-4 py-3",
              selectable && selected.has(item.id) && "bg-brand-tint/60",
            )}
          >
            {selectable && <SelectDot selected={selected.has(item.id)} />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{item.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <ShelfTag code={item.shelf} />
                <StockCount item={item} />
              </div>
            </div>
            <StatusBadge item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BulkBar({
  count,
  busy,
  stockrooms,
  onAdjust,
  onTransfer,
  onWriteOff,
  onClose,
}: {
  count: number;
  busy: boolean;
  stockrooms: StockroomDto[];
  onAdjust: (delta: number) => void;
  onTransfer: (stockroomId: string) => void;
  onWriteOff: (reason: WriteOffReason) => void;
  onClose: () => void;
}) {
  const [delta, setDelta] = useState(1);

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-4 pb-2 sm:bottom-4 sm:left-auto sm:right-6 sm:w-auto sm:px-0">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl bg-ink p-3 text-white shadow-2xl">
        <span className="px-1 text-sm font-semibold tabular-nums">
          {count} selected
        </span>
        <span className="mx-1 hidden h-6 w-px bg-white/20 sm:block" aria-hidden />
        <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
          <input
            type="number"
            min={1}
            value={delta}
            onChange={(e) => setDelta(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Adjustment amount"
            className="h-8 w-12 rounded-md bg-transparent text-center font-mono text-sm focus:outline-none"
          />
          <button
            disabled={busy || count === 0}
            onClick={() => onAdjust(delta)}
            className="rounded-md px-2.5 py-1.5 text-xs font-semibold hover:bg-white/15 disabled:opacity-40"
          >
            + Add
          </button>
          <button
            disabled={busy || count === 0}
            onClick={() => onAdjust(-delta)}
            className="rounded-md px-2.5 py-1.5 text-xs font-semibold hover:bg-white/15 disabled:opacity-40"
          >
            − Remove
          </button>
        </div>
        <label className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5 text-xs font-semibold">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          <select
            disabled={busy || count === 0}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onTransfer(e.target.value);
                e.target.value = "";
              }
            }}
            aria-label="Transfer to stockroom"
            className="bg-transparent text-xs font-semibold focus:outline-none disabled:opacity-40 [&>option]:text-ink"
          >
            <option value="" disabled>
              Transfer to…
            </option>
            {stockrooms.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 rounded-lg bg-danger/90 px-2 py-1.5 text-xs font-semibold hover:bg-danger">
          <Trash2 className="h-3.5 w-3.5" />
          <select
            disabled={busy || count === 0}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onWriteOff(e.target.value as WriteOffReason);
                e.target.value = "";
              }
            }}
            aria-label="Write off remaining stock"
            className="bg-transparent text-xs font-semibold focus:outline-none disabled:opacity-40 [&>option]:text-ink"
          >
            <option value="" disabled>
              Write off…
            </option>
            {WRITE_OFF_REASONS.map((r) => (
              <option key={r} value={r}>
                {WRITE_OFF_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={onClose}
          aria-label="Exit selection mode"
          className="ml-auto rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AddItemSheet({
  open,
  stockrooms,
  onClose,
  onSaved,
}: {
  open: boolean;
  stockrooms: StockroomDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: categories } = useFetch<CategoryDto[]>("/api/categories");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [serialized, setSerialized] = useState(false);

  const isAsset = (categories ?? []).find((c) => c.id === categoryId)?.type === "ASSET";
  const trackSerials = isAsset && serialized;

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
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          model: fd.get("model") || undefined,
          description: fd.get("description") || undefined,
          categoryId: fd.get("categoryId"),
          stockroomId: fd.get("stockroomId"),
          shelf: fd.get("shelf"),
          unit: fd.get("unit"),
          stock: trackSerials ? undefined : Number(fd.get("stock")),
          maxStock: Number(fd.get("maxStock")),
          unitCost: Number(fd.get("unitCost")) || 0,
          sellingPrice: Number(fd.get("sellingPrice")) || 0,
          serialized: trackSerials,
          serials: trackSerials ? serials : undefined,
          batchCode: fd.get("batchCode") || undefined,
          expiry: fd.get("expiry") || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not save item");
      }
      setSerialized(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} side="right" title="Add item">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Item name">
          <Input name="name" required placeholder="e.g. Steps to Christ" />
        </Field>
        <Field label="Model / edition (optional)">
          <Input name="model" placeholder="e.g. Pocket edition, Epson EB-X06" />
        </Field>
        <Field label="Description (optional)">
          <textarea
            name="description"
            rows={2}
            placeholder="e.g. language, edition, remarks"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <SelectInput name="categoryId" value={categoryId} onChange={setCategoryId}>
              <option value="" disabled>
                Select…
              </option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Stockroom">
            <SelectInput name="stockroomId">
              {stockrooms.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shelf code">
            <Input name="shelf" required placeholder="B2-04" className="font-mono uppercase" />
          </Field>
          <Field label="Unit">
            <Input name="unit" required placeholder="copies" />
          </Field>
        </div>
        {isAsset && (
          <label className="flex items-center gap-2.5 rounded-lg bg-brand-tint/50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={serialized}
              onChange={(e) => setSerialized(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            <span className="text-[13px] font-medium text-ink">
              Track individual serial numbers
            </span>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          {!trackSerials && (
            <Field label="Opening stock">
              <Input name="stock" type="number" min={0} required defaultValue={0} className="font-mono" />
            </Field>
          )}
          <Field label="Max / par level">
            <Input name="maxStock" type="number" min={1} required className="font-mono" />
          </Field>
        </div>
        {trackSerials && (
          <Field label="Serial numbers (one per line)">
            <textarea
              name="serials"
              rows={3}
              placeholder={"SN-1001\nSN-1002"}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Batch / lot code (optional)">
            <Input name="batchCode" placeholder="auto" className="font-mono" />
          </Field>
          <Field label="Expiry date (optional)">
            <Input name="expiry" type="date" className="font-mono" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit cost (₱)">
            <Input name="unitCost" type="number" min={0} step="0.01" defaultValue={0} className="font-mono" />
          </Field>
          <Field label="Selling price (₱)">
            <Input name="sellingPrice" type="number" min={0} step="0.01" defaultValue={0} className="font-mono" />
          </Field>
        </div>
        {error && (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={saving}>
          {saving ? "Saving…" : "Save item"}
        </Button>
      </form>
    </Sheet>
  );
}

function SelectInput({
  name,
  value,
  onChange,
  children,
}: {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      required
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
    >
      {children}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
