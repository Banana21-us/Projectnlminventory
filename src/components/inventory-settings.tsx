"use client";

import { Boxes, Package2, Pencil, Plus, PowerOff, Power, Check, X } from "lucide-react";
import { useState } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useFetch } from "@/lib/hooks";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type CategoryDto,
  type StockroomDto,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "stockrooms" | "categories";

export function InventorySettingsSheet({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("stockrooms");

  return (
    <Sheet open={open} onClose={onClose} side="right" title="Manage stockrooms & categories">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-bg p-1">
          {(
            [
              ["stockrooms", "Stockrooms", Boxes],
              ["categories", "Categories", Package2],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-semibold transition-colors",
                tab === value
                  ? "bg-surface text-brand-dark shadow-sm"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === "stockrooms" ? (
          <StockroomsTab onChanged={onChanged} />
        ) : (
          <CategoriesTab onChanged={onChanged} />
        )}
      </div>
    </Sheet>
  );
}

function StockroomsTab({ onChanged }: { onChanged: () => void }) {
  const { data, loading, refetch } = useFetch<StockroomDto[]>("/api/stockrooms?all=1");
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const create = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/stockrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not add stockroom");
      setNewName("");
      await refetch();
      onChanged();
      toast({ kind: "success", title: "Stockroom added" });
    } catch (e) {
      toast({ kind: "error", title: "Could not add", detail: e instanceof Error ? e.message : undefined });
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>, successTitle: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/stockrooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const resBody = await res.json().catch(() => null);
      if (!res.ok) throw new Error(resBody?.error ?? "Update failed");
      await refetch();
      onChanged();
      toast({ kind: "success", title: successTitle });
    } catch (e) {
      toast({ kind: "error", title: "Update failed", detail: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/stockrooms?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Delete failed");
      }
      await refetch();
      onChanged();
      toast({ kind: "success", title: "Stockroom deleted" });
    } catch (e) {
      toast({ kind: "error", title: "Delete failed", detail: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New stockroom name…"
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button size="default" disabled={creating || !newName.trim()} onClick={create}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-line/60" />
          ))}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {(data ?? []).map((s) => (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-bg px-3 py-2 shadow-sm ring-1 ring-black/5",
                !s.active && "opacity-50",
              )}
            >
              {editingId === s.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 flex-1 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void patch(s.id, { action: "rename", name: editName.trim() }, "Renamed").then(
                          () => setEditingId(null),
                        );
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <button
                    disabled={busyId === s.id || !editName.trim()}
                    onClick={() =>
                      patch(s.id, { action: "rename", name: editName.trim() }, "Renamed").then(() =>
                        setEditingId(null),
                      )
                    }
                    className="rounded-md p-1.5 text-success hover:bg-success-tint disabled:opacity-40"
                    aria-label="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-md p-1.5 text-ink-faint hover:bg-line/60"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm font-medium text-ink">{s.name}</span>
                  <button
                    disabled={busyId === s.id}
                    onClick={() => {
                      setEditingId(s.id);
                      setEditName(s.name);
                    }}
                    className="rounded-md p-1.5 text-ink-faint hover:bg-line/60 hover:text-ink disabled:opacity-40"
                    aria-label={`Rename ${s.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={busyId === s.id}
                    onClick={() =>
                      patch(
                        s.id,
                        { action: s.active ? "deactivate" : "activate" },
                        s.active ? "Deactivated" : "Activated",
                      )
                    }
                    className="rounded-md p-1.5 text-ink-faint hover:bg-line/60 hover:text-ink disabled:opacity-40"
                    aria-label={s.active ? `Deactivate ${s.name}` : `Activate ${s.name}`}
                  >
                    {s.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </button>
                  <ConfirmDeleteButton
                    label={s.name}
                    disabled={busyId === s.id}
                    onConfirm={() => remove(s.id)}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoriesTab({ onChanged }: { onChanged: () => void }) {
  const { data, loading, refetch } = useFetch<CategoryDto[]>("/api/categories?all=1");
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Category>("BOOK");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const create = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: newType }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not add category");
      setNewName("");
      await refetch();
      onChanged();
      toast({ kind: "success", title: "Category added" });
    } catch (e) {
      toast({ kind: "error", title: "Could not add", detail: e instanceof Error ? e.message : undefined });
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>, successTitle: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const resBody = await res.json().catch(() => null);
      if (!res.ok) throw new Error(resBody?.error ?? "Update failed");
      await refetch();
      onChanged();
      toast({ kind: "success", title: successTitle });
    } catch (e) {
      toast({ kind: "error", title: "Update failed", detail: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Delete failed");
      }
      await refetch();
      onChanged();
      toast({ kind: "success", title: "Category deleted" });
    } catch (e) {
      toast({ kind: "error", title: "Delete failed", detail: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name…"
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <div className="flex gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as Category)}
            aria-label="Category type"
            className="min-h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <Button disabled={creating || !newName.trim()} onClick={create}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-line/60" />
          ))}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {(data ?? []).map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-bg px-3 py-2 shadow-sm ring-1 ring-black/5",
                !c.active && "opacity-50",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                <select
                  value={c.type}
                  disabled={busyId === c.id}
                  onChange={(e) => patch(c.id, { action: "retype", type: e.target.value }, "Type updated")}
                  aria-label={`Type for ${c.name}`}
                  className="mt-0.5 rounded border-none bg-transparent text-[11px] text-ink-faint focus:outline-none disabled:opacity-40"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                disabled={busyId === c.id}
                onClick={() =>
                  patch(
                    c.id,
                    { action: c.active ? "deactivate" : "activate" },
                    c.active ? "Deactivated" : "Activated",
                  )
                }
                className="rounded-md p-1.5 text-ink-faint hover:bg-line/60 hover:text-ink disabled:opacity-40"
                aria-label={c.active ? `Deactivate ${c.name}` : `Activate ${c.name}`}
              >
                {c.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
              </button>
              <ConfirmDeleteButton
                label={c.name}
                disabled={busyId === c.id}
                onConfirm={() => remove(c.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
