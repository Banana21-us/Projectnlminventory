"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { homeFor } from "@/lib/policies";
import type { Role } from "@prisma/client";
import styles from "./login.module.css";
import { INVENTORY_SCENE_SVG, GUESTHOUSE_SCENE_SVG } from "./login-art";
import { cn } from "@/lib/utils";

type Mode = "inventory" | "guesthouse";
const ORDER: Mode[] = ["inventory", "guesthouse"];
const NAMES: Record<Mode, string> = { inventory: "Inventory", guesthouse: "Guesthouse" };
// Which account roles are allowed to log in through each mode — the actual
// gate. The mode switch itself is just which portal you're presenting; a
// valid login through the wrong one is rejected rather than silently
// honored, since STAFF/ADMIN and GUESTHOUSE are meant to land in different
// apps (see homeFor in policies.ts).
const MODE_ROLES: Record<Mode, Role[]> = {
  inventory: ["ADMIN", "STAFF"],
  guesthouse: ["GUESTHOUSE"],
};

/** className for an element belonging to `elMode`, given which mode is
 *  currently active — mirrors the original design's setMode(). */
function slideClass(elMode: Mode, active: Mode): string {
  const state =
    elMode === active ? "isOn" : ORDER.indexOf(elMode) < ORDER.indexOf(active) ? "isLeft" : "isRight";
  return cn(styles.slide, styles[state]);
}

function SceneArt({ html }: { html: string }) {
  return <div className={styles.artSvg} dangerouslySetInnerHTML={{ __html: html }} />;
}

const ERROR_ICON = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <circle cx="10" cy="10" r="8" />
    <path d="M10 6v4.5M10 13.5h.01" />
  </svg>
);
const OK_ICON = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="10" r="8" />
    <path d="m6.5 10.2 2.3 2.3 4.7-4.8" />
  </svg>
);
const INFO_ICON = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <circle cx="10" cy="10" r="8" />
    <path d="M10 9v5M10 6.5h.01" />
  </svg>
);
const FIELD_ERROR_ICON = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" />
    <path d="M8 4.8v3.6M8 11h.01" />
  </svg>
);

type Notice = { kind: "isError" | "isOk" | "isInfo"; body: React.ReactNode } | null;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("inventory");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const passRef = useRef<HTMLInputElement>(null);
  const userRef = useRef<HTMLInputElement>(null);

  // Restore a remembered username/mode. This has to run after mount, not in
  // a useState initializer: the server has no localStorage, so seeding state
  // from it during render makes the first client render disagree with the
  // server HTML and React reports a hydration mismatch. Reading from an
  // external store on mount is what effects are for, hence the disable.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("nlm.user");
      const savedMode = localStorage.getItem("nlm.mode") as Mode | null;
      if (savedUser) {
        setUsername(savedUser);
        setRemember(true);
      }
      if (savedMode && ORDER.includes(savedMode)) setMode(savedMode);
    } catch {
      // localStorage unavailable — restoring a remembered login is a nicety, not required.
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function changeMode(next: Mode) {
    if (busy) return;
    setMode(next);
    setNotice(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setNotice(null);
    const u = username.trim();
    const p = password;
    setUsernameError(u ? "" : "Please enter your username.");
    setPasswordError(p ? "" : "Please enter your password.");
    if (!u) return userRef.current?.focus();
    if (!p) return passRef.current?.focus();

    setBusy(true);
    const result = await signIn("credentials", { username: u, password: p, redirect: false });

    if (result?.error) {
      setPassword("");
      setNotice({ kind: "isError", body: <><b>Invalid username or password.</b> Check your details and try again.</> });
      setBusy(false);
      passRef.current?.focus();
      return;
    }

    const session = await getSession();
    const role = session?.user?.role;
    if (!role || !MODE_ROLES[mode].includes(role)) {
      // Credentials were fine, but this account doesn't belong on this
      // portal — undo the session rather than dropping them into a section
      // they don't have access to.
      await signOut({ redirect: false });
      setBusy(false);
      setNotice({
        kind: "isError",
        body: (
          <>
            <b>This account doesn&apos;t have {NAMES[mode]} access.</b>{" "}
            {role
              ? `Try the ${NAMES[MODE_ROLES.inventory.includes(role) ? "inventory" : "guesthouse"]} portal instead.`
              : "Check with the NLM IT office if you think this is wrong."}
          </>
        ),
      });
      return;
    }

    if (remember) {
      try {
        localStorage.setItem("nlm.user", u);
        localStorage.setItem("nlm.mode", mode);
      } catch {
        // best-effort only
      }
    } else {
      try {
        localStorage.removeItem("nlm.user");
        localStorage.removeItem("nlm.mode");
      } catch {
        // best-effort only
      }
    }

    setNotice({ kind: "isOk", body: <><b>Logged in to {NAMES[mode]}.</b> Opening your workspace.</> });
    router.push(homeFor(role));
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <div className={cn(styles.shell, mode === "guesthouse" && styles.guesthouseActive)}>
        {/* Left: system panel */}
        <aside className={styles.system} aria-hidden="true">
          <div className={styles.brand}>
            <div className={styles.mark} aria-hidden="true">
              <Image src="/logo-churches.png" alt="" fill sizes="52px" className="object-contain p-1" />
            </div>
            <div className={styles.brandName}>
              <b>Northern Luzon Mission</b>
              <span>Management Portal</span>
            </div>
          </div>

          <div className={styles.photos}>
            <figure className={cn(styles.photo, styles.art, slideClass("inventory", mode))}>
              <SceneArt html={INVENTORY_SCENE_SVG} />
            </figure>
            <figure className={cn(styles.photo, styles.art, slideClass("guesthouse", mode))}>
              <SceneArt html={GUESTHOUSE_SCENE_SVG} />
            </figure>
          </div>
          <div className={styles.shade} />

          <div className={styles.systemBody}>
            <div className={cn(styles.stack, styles.chips)}>
              <div className={cn(styles.chip, slideClass("inventory", mode))}>
                <span className={styles.chipDot} />
                <span>
                  <small>Bible</small>
                  <b>Qty 777</b>
                </span>
                <span className={styles.chipDelta}>+12 received</span>
              </div>
              <div className={cn(styles.chip, slideClass("guesthouse", mode))}>
                <span className={styles.chipDot} />
                <span>
                  <small>Room 204</small>
                  <b>Check-in 2:00 PM</b>
                </span>
                <span className={styles.chipDelta}>Confirmed</span>
              </div>
            </div>
            <div className={styles.stack}>
              <p className={cn(styles.sysName, slideClass("inventory", mode))}>Inventory</p>
              <p className={cn(styles.sysName, slideClass("guesthouse", mode))}>Guesthouse</p>
            </div>
            <div className={styles.stack}>
              <p className={cn(styles.sysDesc, slideClass("inventory", mode))}>
                Supplies, stock levels and item movement at the NLM headquarters.
              </p>
              <p className={cn(styles.sysDesc, slideClass("guesthouse", mode))}>
                Rooms, reservations and guest check-in and check-out.
              </p>
            </div>
          </div>

          <div className={styles.systemFoot}>
            <span>© 2026 Northern Luzon Mission</span>
            <span className={styles.modeCount}>
              <b>{ORDER.indexOf(mode) + 1}</b> of 2 systems
            </span>
          </div>
        </aside>

        {/* Right: login */}
        <main className={styles.login}>
          <div className={styles.loginInner}>
            <div className={styles.brand}>
              <div className={styles.mark} aria-hidden="true">
                <Image src="/logo-churches.png" alt="" fill sizes="46px" className="object-contain p-1" />
              </div>
              <div className={styles.brandName}>
                <b>Northern Luzon Mission</b>
                <span>Management Portal</span>
              </div>
            </div>

            <div className={styles.mode}>
              <span className={styles.modeLabel} id="modeLabel">System</span>
              <div className={styles.switch} role="group" aria-labelledby="modeLabel">
                <span className={styles.plate} aria-hidden="true" />
                <button
                  type="button"
                  aria-pressed={mode === "inventory"}
                  disabled={busy}
                  onClick={() => changeMode("inventory")}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6.5 10 3l7 3.5v7L10 17l-7-3.5z" />
                    <path d="M3 6.5 10 10l7-3.5M10 10v7" />
                  </svg>
                  Inventory
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "guesthouse"}
                  disabled={busy}
                  onClick={() => changeMode("guesthouse")}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                    <circle cx="6.5" cy="10" r="3.5" />
                    <path d="M10 10h7.5M15 10v3M17.5 10v2" />
                  </svg>
                  Guesthouse
                </button>
              </div>
            </div>

            <div className={styles.head}>
              <h1 className={styles.stack} aria-live="polite">
                <span className={slideClass("inventory", mode)} aria-hidden={mode !== "inventory"}>
                  Inventory Login
                </span>
                <span className={slideClass("guesthouse", mode)} aria-hidden={mode !== "guesthouse"}>
                  Guesthouse Login
                </span>
              </h1>
              <p className={styles.stack}>
                <span className={slideClass("inventory", mode)} aria-hidden={mode !== "inventory"}>
                  Login to access the NLM Inventory management portal.
                </span>
                <span className={slideClass("guesthouse", mode)} aria-hidden={mode !== "guesthouse"}>
                  Login to access the NLM Guesthouse management portal.
                </span>
              </p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {notice && (
                <div className={cn(styles.notice, styles[notice.kind])} role="alert">
                  {notice.kind === "isError" ? ERROR_ICON : notice.kind === "isOk" ? OK_ICON : INFO_ICON}
                  <div>{notice.body}</div>
                </div>
              )}

              <div className={styles.field}>
                <label htmlFor="username">Username</label>
                <div className={styles.control}>
                  <input
                    ref={userRef}
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Enter your username"
                    disabled={busy}
                    aria-invalid={!!usernameError}
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (e.target.value.trim()) setUsernameError("");
                      if (notice?.kind === "isError") setNotice(null);
                    }}
                  />
                </div>
                {usernameError && (
                  <p className={styles.error}>
                    {FIELD_ERROR_ICON}
                    <span>{usernameError}</span>
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="password">Password</label>
                <div className={cn(styles.control, styles.hasToggle)}>
                  <input
                    ref={passRef}
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={busy}
                    aria-invalid={!!passwordError}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (e.target.value) setPasswordError("");
                      if (notice?.kind === "isError") setNotice(null);
                    }}
                    onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
                    onKeyDown={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
                    onBlur={() => setCapsOn(false)}
                  />
                  <button
                    type="button"
                    className={styles.reveal}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    disabled={busy}
                    onClick={() => {
                      setShowPassword((v) => !v);
                      passRef.current?.focus();
                    }}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                        <path d="M3 3l14 14M8.2 5.2A8 8 0 0 1 10 5c5.5 0 8.5 5 8.5 5a14 14 0 0 1-2.4 3M5.4 6.6A14 14 0 0 0 1.5 10S4.5 15 10 15a8 8 0 0 0 3.2-.7" />
                        <path d="M8.3 8.4a2.4 2.4 0 0 0 3.3 3.3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6z" />
                        <circle cx="10" cy="10" r="2.6" />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className={styles.error}>
                    {FIELD_ERROR_ICON}
                    <span>{passwordError}</span>
                  </p>
                )}
                {capsOn && !passwordError && (
                  <p className={styles.hint}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 2 2.5 8H5v4h6V8h2.5z" />
                    </svg>
                    Caps Lock is on.
                  </p>
                )}
              </div>

              <div className={styles.row}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={remember}
                    disabled={busy}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() =>
                    setNotice({
                      kind: "isInfo",
                      body: (
                        <>
                          <b>Forgot your password?</b> Ask the NLM IT office to reset it. Your {NAMES[mode]} access
                          stays the same.
                        </>
                      ),
                    })
                  }
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className={cn(styles.submit, busy && styles.isLoading)}
                disabled={busy}
                aria-busy={busy}
              >
                {busy && <span className={styles.spinner} aria-hidden="true" />}
                <span>LOGIN</span>
              </button>
            </form>

            <div className={styles.foot}>
              <span>© 2026 Northern Luzon Mission</span>
              <span>Authorized personnel only</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
