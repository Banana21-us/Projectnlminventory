"use client";

import { Building2, Plus, Search, Settings, User, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { RecipientSettingsSheet } from "@/components/recipient-settings";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFetch } from "@/lib/hooks";
import { useCurrentUser } from "@/lib/use-user";
import {
  RECIPIENT_TAB_LABELS,
  RECIPIENT_TAB_PURPOSE,
  RECIPIENT_TAB_TYPE,
  type DistrictDto,
  type RecipientDto,
  type RecipientTab,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<RecipientTab, typeof Building2> = {
  DEPARTMENT: Building2,
  PASTOR: UserRound,
  GUEST: User,
};

export interface RecipientSelection {
  recipientId?: string;
  name: string;
  purpose: string;
  note?: string;
}

export function RecipientPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: RecipientSelection) => void;
}) {
  const [tab, setTab] = useState<RecipientTab>("DEPARTMENT");
  const [search, setSearch] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newDistrictOpen, setNewDistrictOpen] = useState(false);
  const [newDistrictName, setNewDistrictName] = useState("");
  const [addingDistrict, setAddingDistrict] = useState(false);
  const [districtError, setDistrictError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { can } = useCurrentUser();

  // Department dispenses ask "who availed it" (an employee) as an extra
  // step before finalizing — everyone else picks and closes immediately.
  const [pendingDept, setPendingDept] = useState<RecipientDto | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const employeeQuery = new URLSearchParams({
    type: "MEMBER",
    ...(employeeSearch.trim() ? { search: employeeSearch.trim() } : {}),
  });
  const { data: employees, loading: employeesLoading, refetch: refetchEmployees } = useFetch<
    RecipientDto[]
  >(pendingDept ? `/api/recipients?${employeeQuery.toString()}` : "");

  const type = RECIPIENT_TAB_TYPE[tab];
  const query = new URLSearchParams({ type, ...(search.trim() ? { search: search.trim() } : {}) });
  const { data: recipients, loading, refetch } = useFetch<RecipientDto[]>(
    open ? `/api/recipients?${query.toString()}` : "",
  );
  const { data: districts, refetch: refetchDistricts } = useFetch<DistrictDto[]>(
    open ? "/api/districts" : "",
  );

  const filtered = useMemo(() => {
    if (!recipients) return [];
    if (tab !== "PASTOR" || !districtId) return recipients;
    return recipients.filter((r) => r.districtId === districtId);
  }, [recipients, tab, districtId]);

  const changeTab = (next: RecipientTab) => {
    setTab(next);
    setSearch("");
    setDistrictId("");
    setAddError(null);
    setNewEmail("");
    setNewDistrictOpen(false);
    setNewDistrictName("");
    setDistrictError(null);
    setPendingDept(null);
    setEmployeeSearch("");
    setNewEmployeeName("");
    setEmployeeError(null);
  };

  const addDistrict = async () => {
    const name = newDistrictName.trim();
    if (!name || addingDistrict) return;
    setAddingDistrict(true);
    setDistrictError(null);
    try {
      const res = await fetch("/api/districts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not add district");
      await refetchDistricts();
      setDistrictId((body as DistrictDto).id);
      setNewDistrictOpen(false);
      setNewDistrictName("");
    } catch (e) {
      setDistrictError(e instanceof Error ? e.message : "Could not add district");
    } finally {
      setAddingDistrict(false);
    }
  };

  const pick = (r: RecipientDto) => {
    if (tab === "DEPARTMENT") {
      setPendingDept(r);
      return;
    }
    const name = r.districtName ? `${r.name} (${r.districtName})` : r.name;
    onSelect({ recipientId: r.id, name, purpose: RECIPIENT_TAB_PURPOSE[tab] });
    onClose();
  };

  const finalizeDept = (employeeName?: string) => {
    if (!pendingDept) return;
    onSelect({
      recipientId: pendingDept.id,
      name: pendingDept.name,
      purpose: RECIPIENT_TAB_PURPOSE.DEPARTMENT,
      ...(employeeName ? { note: `Availed by: ${employeeName}` } : {}),
    });
    setPendingDept(null);
    onClose();
  };

  const closePicker = () => {
    setPendingDept(null);
    onClose();
  };

  const addEmployee = async () => {
    const name = newEmployeeName.trim();
    if (!name || addingEmployee) return;
    setAddingEmployee(true);
    setEmployeeError(null);
    try {
      const res = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: "MEMBER" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not add employee");
      void refetchEmployees();
      finalizeDept((body as RecipientDto).name);
    } catch (e) {
      setEmployeeError(e instanceof Error ? e.message : "Could not add employee");
    } finally {
      setAddingEmployee(false);
    }
  };

  const quickAdd = async () => {
    const name = search.trim();
    if (!name || adding) return;
    if (tab === "PASTOR" && !districtId) {
      setAddError("Pick a district first.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          ...(tab === "PASTOR" ? { districtId } : {}),
          ...(newEmail.trim() ? { email: newEmail.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not add");
      pick(body as RecipientDto);
      setNewEmail("");
      void refetch();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Could not add");
    } finally {
      setAdding(false);
    }
  };

  if (pendingDept) {
    return (
      <Sheet open={open} onClose={closePicker} side="right" title="Who availed it?">
        <div className="space-y-4">
          <button
            onClick={() => setPendingDept(null)}
            className="text-xs font-medium text-ink-soft hover:text-ink"
          >
            ← Back to departments
          </button>
          <div className="rounded-lg bg-brand-tint px-3.5 py-2.5 text-sm font-medium text-brand-dark">
            {pendingDept.name}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="Search employees (optional)…"
              className="pl-10"
              autoFocus
            />
          </div>

          {employeesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-lg bg-line/60" />
              ))}
            </div>
          ) : (
            <ul className="max-h-[35vh] space-y-1.5 overflow-y-auto">
              {(employees ?? []).map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => finalizeDept(e.name)}
                    className="w-full truncate rounded-lg bg-bg px-3.5 py-2.5 text-left text-sm font-medium text-ink shadow-sm ring-1 ring-black/5 transition-colors hover:bg-brand-tint hover:text-brand-dark"
                  >
                    {e.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-line pt-3">
            {employeeSearch.trim() && (
              <>
                {employeeError && (
                  <p className="text-[13px] font-medium text-danger">{employeeError}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={addingEmployee}
                  onClick={addEmployee}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {addingEmployee
                    ? "Adding…"
                    : `Add "${employeeSearch.trim()}" as a new employee`}
                </Button>
              </>
            )}
            <Button variant="ghost" className="w-full" onClick={() => finalizeDept()}>
              Skip — no employee name
            </Button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={closePicker} side="right" title="Who is this for?">
      <div className="space-y-4">
        {can("settings.manage") && (
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink"
          >
            <Settings className="h-3.5 w-3.5" />
            Manage departments, pastors & guests
          </button>
        )}

        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-bg p-1">
          {(Object.keys(RECIPIENT_TAB_LABELS) as RecipientTab[]).map((t) => {
            const Icon = TAB_ICONS[t];
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => changeTab(t)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-semibold transition-colors",
                  active
                    ? "bg-surface text-brand-dark shadow-sm"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {RECIPIENT_TAB_LABELS[t]}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${RECIPIENT_TAB_LABELS[tab].toLowerCase()}s…`}
            className="pl-10"
            autoFocus
          />
        </div>

        {tab === "PASTOR" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                aria-label="Filter by district"
                className="min-h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
              >
                <option value="">All districts</option>
                {(districts ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => setNewDistrictOpen((v) => !v)}
                aria-label="Add a new district"
                title="Add a new district"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {newDistrictOpen && (
              <div className="space-y-1.5 rounded-lg bg-bg p-2.5">
                <div className="flex gap-2">
                  <Input
                    value={newDistrictName}
                    onChange={(e) => setNewDistrictName(e.target.value)}
                    placeholder="New district name…"
                    className="h-9 flex-1 text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && addDistrict()}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={addingDistrict || !newDistrictName.trim()}
                    onClick={addDistrict}
                  >
                    {addingDistrict ? "Adding…" : "Add"}
                  </Button>
                </div>
                {districtError && (
                  <p className="text-[12px] font-medium text-danger">{districtError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-line/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-ink-faint">
            No {RECIPIENT_TAB_LABELS[tab].toLowerCase()}s match — add one below.
          </p>
        ) : (
          <ul className="max-h-[45vh] space-y-1.5 overflow-y-auto">
            {filtered.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => pick(r)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg bg-bg px-3.5 py-2.5 text-left text-sm font-medium text-ink shadow-sm ring-1 ring-black/5 transition-colors hover:bg-brand-tint hover:text-brand-dark"
                >
                  <span className="truncate">{r.name}</span>
                  {r.districtName && (
                    <span className="shrink-0 text-[11px] font-normal text-ink-faint">
                      {r.districtName}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {search.trim() && (
          <div className="space-y-2 border-t border-line pt-3">
            {(tab === "PASTOR" || tab === "GUEST") && (
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                type="email"
                placeholder="Email (optional) — for dispense notices"
                className="text-sm"
              />
            )}
            {addError && (
              <p className="text-[13px] font-medium text-danger">{addError}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={adding}
              onClick={quickAdd}
            >
              <Plus className="h-3.5 w-3.5" />
              {adding
                ? "Adding…"
                : `Add "${search.trim()}" as a new ${RECIPIENT_TAB_LABELS[tab].toLowerCase()}`}
            </Button>
          </div>
        )}
      </div>

      <RecipientSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChanged={() => {
          void refetch();
          void refetchDistricts();
        }}
      />
    </Sheet>
  );
}
