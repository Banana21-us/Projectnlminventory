"use client";

import { KeyRound, Plus, ShieldCheck, UserX, UserCheck } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useFetch } from "@/lib/hooks";
import { useCurrentUser } from "@/lib/use-user";
import type { Role } from "@/lib/types";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

const ROLES: Role[] = ["ADMIN", "STAFF", "GUESTHOUSE"];

const ROLE_BADGES: Record<Role, "brand" | "neutral" | "warning"> = {
  ADMIN: "brand",
  STAFF: "neutral",
  GUESTHOUSE: "warning",
};

export default function AdminPage() {
  const { data: users, loading, refetch } = useFetch<UserRow[]>("/api/admin/users");
  const { email: myEmail } = useCurrentUser();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>, successTitle: string) => {
    setBusyId(body.id as string);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Update failed");
      }
      toast({ kind: "success", title: successTitle });
      await refetch();
    } catch (e) {
      toast({
        kind: "error",
        title: "Update failed",
        detail: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">User accounts</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Only admins can create accounts and assign roles — there is no self-signup.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New account
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-line/60" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-black/5">
          {(users ?? []).map((u) => {
            const isMe = u.email === myEmail;
            const busy = busyId === u.id;
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {u.name}
                    {isMe && <span className="ml-2 text-[11px] font-medium text-ink-faint">(you)</span>}
                    {!u.active && (
                      <span className="ml-2 text-[11px] font-medium text-danger">deactivated</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-ink-soft">{u.email}</p>
                </div>
                <Badge variant={ROLE_BADGES[u.role]}>
                  <ShieldCheck className="h-3 w-3" /> {u.role}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <select
                    value={u.role}
                    disabled={busy || isMe}
                    onChange={(e) => patch({ id: u.id, action: "setRole", role: e.target.value }, "Role updated")}
                    aria-label={`Role for ${u.name}`}
                    className="min-h-9 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink focus:border-brand focus:outline-none disabled:opacity-40"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setResetFor(u)}
                    title="Reset password"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || isMe}
                    onClick={() =>
                      patch(
                        { id: u.id, action: u.active ? "deactivate" : "activate" },
                        u.active ? "Account deactivated" : "Account reactivated",
                      )
                    }
                    title={u.active ? "Deactivate" : "Activate"}
                  >
                    {u.active ? (
                      <UserX className="h-3.5 w-3.5 text-danger" />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5 text-success" />
                    )}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CreateUserSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          toast({ kind: "success", title: "Account created" });
          void refetch();
        }}
      />

      <ResetPasswordSheet
        user={resetFor}
        onClose={() => setResetFor(null)}
        onSaved={() => {
          setResetFor(null);
          toast({ kind: "success", title: "Password reset" });
        }}
      />
    </div>
  );
}

function CreateUserSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          password: fd.get("password"),
          role: fd.get("role"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not create account");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} side="right" title="New account">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <Input name="name" required placeholder="e.g. Juan Dela Cruz" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required placeholder="name@nlm.org" />
        </Field>
        <Field label="Temporary password (min 8 characters)">
          <Input name="password" type="password" required minLength={8} />
        </Field>
        <Field label="Role">
          <select
            name="role"
            required
            defaultValue="STAFF"
            className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={saving}>
          {saving ? "Creating…" : "Create account"}
        </Button>
      </form>
    </Sheet>
  );
}

function ResetPasswordSheet({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          action: "resetPassword",
          password: fd.get("password"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not reset password");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={!!user}
      onClose={onClose}
      side="right"
      title={user ? `Reset password — ${user.name}` : "Reset password"}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="New temporary password (min 8 characters)">
          <Input name="password" type="password" required minLength={8} autoFocus />
        </Field>
        {error && (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={saving}>
          {saving ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </Sheet>
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
