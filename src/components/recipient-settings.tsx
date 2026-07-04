"use client";

import { Building2, Check, Mail, MapPin, Pencil, Plus, Power, PowerOff, User, UserRound, X } from "lucide-react";
import { useState } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useFetch } from "@/lib/hooks";
import type { DistrictDto, RecipientDto, RecipientType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "DEPARTMENT" | "PASTOR" | "GUEST" | "EMPLOYEE" | "DISTRICT";

const TAB_ICONS: Record<Tab, typeof Building2> = {
  DEPARTMENT: Building2,
  PASTOR: UserRound,
  GUEST: User,
  EMPLOYEE: User,
  DISTRICT: MapPin,
};

const TAB_LABELS: Record<Tab, string> = {
  DEPARTMENT: "Department",
  PASTOR: "Pastor",
  GUEST: "Guest",
  EMPLOYEE: "Employee",
  DISTRICT: "District",
};

// Employee reuses the existing MEMBER recipient type — it's the "who
// availed it" picker shown when Department is chosen in the dispense flow.
const TAB_TYPE: Record<Exclude<Tab, "DISTRICT">, RecipientType> = {
  DEPARTMENT: "DEPARTMENT",
  PASTOR: "PASTOR",
  GUEST: "GUESTHOUSE",
  EMPLOYEE: "MEMBER",
};

export function RecipientSettingsSheet({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("DEPARTMENT");

  return (
    <Sheet open={open} onClose={onClose} side="right" title="Manage departments, pastors, guests & employees">
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-1.5 rounded-lg bg-bg p-1">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
            const Icon = TAB_ICONS[t];
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-md py-2 text-[10px] font-semibold transition-colors",
                  active ? "bg-surface text-brand-dark shadow-sm" : "text-ink-soft hover:text-ink",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {TAB_LABELS[t]}
              </button>
            );
          })}
        </div>

        {tab === "DISTRICT" ? (
          <DistrictsTab onChanged={onChanged} />
        ) : (
          <RecipientsTab
            tab={tab}
            type={TAB_TYPE[tab]}
            label={TAB_LABELS[tab]}
            showDistrict={tab === "PASTOR"}
            showEmail={tab === "PASTOR" || tab === "GUEST"}
            onChanged={onChanged}
          />
        )}
      </div>
    </Sheet>
  );
}

function RecipientsTab({
  tab,
  type,
  label,
  showDistrict,
  showEmail,
  onChanged,
}: {
  tab: Exclude<Tab, "DISTRICT">;
  type: RecipientType;
  label: string;
  showDistrict: boolean;
  showEmail: boolean;
  onChanged: () => void;
}) {
  const { data, loading, refetch } = useFetch<RecipientDto[]>(`/api/recipients?type=${type}&all=1`);
  const { data: districts } = useFetch<DistrictDto[]>(showDistrict ? "/api/districts" : "");
  const toast = useToast();

  const [newName, setNewName] = useState("");
  const [newDistrictId, setNewDistrictId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const canHaveEmail = showEmail;

  const create = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    if (showDistrict && !newDistrictId) {
      toast({ kind: "error", title: "Pick a district first" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          ...(showDistrict ? { districtId: newDistrictId } : {}),
          ...(newEmail.trim() ? { email: newEmail.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not add");
      setNewName("");
      setNewDistrictId("");
      setNewEmail("");
      await refetch();
      onChanged();
      toast({ kind: "success", title: `${label} added` });
    } catch (e) {
      toast({ kind: "error", title: "Could not add", detail: e instanceof Error ? e.message : undefined });
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>, successTitle: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/recipients", {
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
      const res = await fetch(`/api/recipients?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Delete failed");
      }
      await refetch();
      onChanged();
      toast({ kind: "success", title: `${label} deleted` });
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
          placeholder={`New ${label.toLowerCase()} name…`}
          onKeyDown={(e) => e.key === "Enter" && !showDistrict && create()}
        />
        {showDistrict && (
          <select
            value={newDistrictId}
            onChange={(e) => setNewDistrictId(e.target.value)}
            aria-label={`District for new ${label.toLowerCase()}`}
            className="min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
          >
            <option value="">Pick a district…</option>
            {(districts ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        {canHaveEmail && (
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            type="email"
            placeholder="Email (optional) — for dispense notices"
          />
        )}
        <Button className="w-full" disabled={creating || !newName.trim()} onClick={create}>
          <Plus className="h-4 w-4" /> Add {label.toLowerCase()}
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
          {(data ?? []).map((r) => (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-bg px-3 py-2 shadow-sm ring-1 ring-black/5",
                !r.active && "opacity-50",
              )}
            >
              {editingId === r.id ? (
                <>
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                    />
                    {canHaveEmail && (
                      <Input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        type="email"
                        placeholder="Email (optional)"
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                      />
                    )}
                  </div>
                  <button
                    disabled={busyId === r.id || !editName.trim()}
                    onClick={async () => {
                      await patch(r.id, { action: "rename", name: editName.trim() }, "Renamed");
                      if (canHaveEmail) {
                        await patch(
                          r.id,
                          { action: "setEmail", email: editEmail.trim() || null },
                          "Email updated",
                        );
                      }
                      setEditingId(null);
                    }}
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {tab === "PASTOR" && (
                        <select
                          value={r.districtId ?? ""}
                          disabled={busyId === r.id}
                          onChange={(e) =>
                            patch(r.id, { action: "setDistrict", districtId: e.target.value || null }, "District updated")
                          }
                          aria-label={`District for ${r.name}`}
                          className="rounded border-none bg-transparent text-[11px] text-ink-faint focus:outline-none disabled:opacity-40"
                        >
                          <option value="">No district</option>
                          {(districts ?? []).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {canHaveEmail && r.email && (
                        <span className="flex items-center gap-1 truncate text-[11px] text-ink-faint">
                          <Mail className="h-3 w-3 shrink-0" />
                          {r.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => {
                      setEditingId(r.id);
                      setEditName(r.name);
                      setEditEmail(r.email ?? "");
                    }}
                    className="rounded-md p-1.5 text-ink-faint hover:bg-line/60 hover:text-ink disabled:opacity-40"
                    aria-label={`Rename ${r.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() =>
                      patch(r.id, { action: r.active ? "deactivate" : "activate" }, r.active ? "Deactivated" : "Activated")
                    }
                    className="rounded-md p-1.5 text-ink-faint hover:bg-line/60 hover:text-ink disabled:opacity-40"
                    aria-label={r.active ? `Deactivate ${r.name}` : `Activate ${r.name}`}
                  >
                    {r.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </button>
                  <ConfirmDeleteButton
                    label={r.name}
                    disabled={busyId === r.id}
                    onConfirm={() => remove(r.id)}
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

function DistrictsTab({ onChanged }: { onChanged: () => void }) {
  const { data, loading, refetch } = useFetch<DistrictDto[]>("/api/districts?all=1");
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
      const res = await fetch("/api/districts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not add district");
      setNewName("");
      await refetch();
      onChanged();
      toast({ kind: "success", title: "District added" });
    } catch (e) {
      toast({ kind: "error", title: "Could not add", detail: e instanceof Error ? e.message : undefined });
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>, successTitle: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/districts", {
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
      const res = await fetch(`/api/districts?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Delete failed");
      }
      await refetch();
      onChanged();
      toast({ kind: "success", title: "District deleted" });
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
          placeholder="New district name…"
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button disabled={creating || !newName.trim()} onClick={create}>
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
          {(data ?? []).map((d) => (
            <li
              key={d.id}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-bg px-3 py-2 shadow-sm ring-1 ring-black/5",
                !d.active && "opacity-50",
              )}
            >
              {editingId === d.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 flex-1 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void patch(d.id, { action: "rename", name: editName.trim() }, "Renamed").then(() =>
                          setEditingId(null),
                        );
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <button
                    disabled={busyId === d.id || !editName.trim()}
                    onClick={() =>
                      patch(d.id, { action: "rename", name: editName.trim() }, "Renamed").then(() =>
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
                  <span className="flex-1 truncate text-sm font-medium text-ink">{d.name}</span>
                  <button
                    disabled={busyId === d.id}
                    onClick={() => {
                      setEditingId(d.id);
                      setEditName(d.name);
                    }}
                    className="rounded-md p-1.5 text-ink-faint hover:bg-line/60 hover:text-ink disabled:opacity-40"
                    aria-label={`Rename ${d.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={busyId === d.id}
                    onClick={() =>
                      patch(d.id, { action: d.active ? "deactivate" : "activate" }, d.active ? "Deactivated" : "Activated")
                    }
                    className="rounded-md p-1.5 text-ink-faint hover:bg-line/60 hover:text-ink disabled:opacity-40"
                    aria-label={d.active ? `Deactivate ${d.name}` : `Activate ${d.name}`}
                  >
                    {d.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </button>
                  <ConfirmDeleteButton
                    label={d.name}
                    disabled={busyId === d.id}
                    onConfirm={() => remove(d.id)}
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
