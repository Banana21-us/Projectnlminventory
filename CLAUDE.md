# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Northern Luzon Mission (NLM) inventory, dispensing, and guesthouse system. Tracks Bible books, baptismal materials, office supplies, and other stock across multiple stockrooms; dispenses/sells it with a full costed movement ledger; emails dispense notices; generates accounting-ready PDF reports; and (in progress) manages guesthouse room bookings under a separate role.

Deployment is in flux: originally a single office PC (XAMPP MySQL) behind a Cloudflare tunnel, currently being tested on Vercel + Neon Postgres. **Check `prisma/schema.prisma`'s `datasource` provider before assuming which database is live** — it gets flipped between `mysql` and `postgresql` as the target changes, and the two aren't schema-compatible (switching requires a fresh `prisma db push`, not `migrate`, since the migration history is provider-specific).

> `README.md` in this repo describes an earlier/aspirational architecture (a different Prisma version, `NEXT_PUBLIC_BASE_URL`, `dashboard/*` routes, different models like `StockMovement`/`Department`). It does not match the current code — trust the source, not the README.

## Commands

```bash
npm run dev              # dev server
npm run build             # production build (also runs TypeScript checks — treat build failures as real errors)
npm run start             # run the production build
npm run lint              # eslint

npx prisma db push                     # sync schema.prisma to the DB without migration history (used for Neon/testing)
npx prisma migrate dev --name <name>   # create/apply a versioned migration (used for the MySQL/on-prem target)
npx prisma db seed                     # re-run prisma/seed.ts — users, stockrooms, categories, districts, sample items
npx prisma generate                    # regenerate the client after any schema.prisma change
npx prisma studio                      # inspect the data directly
```

There is no test runner configured in this project.

**Windows gotcha**: `prisma generate` fails with `EPERM ... query_engine-windows.dll.node` if any Node process (a running `next dev`/`next start`, including an orphaned one) has the client loaded. Check `netstat -ano | grep LISTENING` and `tasklist | grep node` for stray processes before assuming the DB/schema is broken — this is a file lock, not a real error. Background `npx next start` processes started for testing can survive being "stopped" as zombie children on Windows; kill by PID directly (`taskkill //PID <n> //F`) if `netstat` still shows the port listening after stopping it.

## Architecture

### Security model — deliberately Laravel-shaped

The user has a Laravel/Livewire background, so the auth/authorization layers intentionally mirror Laravel's terms. When adding a feature, follow this same structure rather than inventing a new pattern:

- **Gates** — `src/lib/policies.ts`. One `PERMISSIONS` map of `"resource.action" → Role[]`, checked via `can(role, permission)`. This is the single source of truth for who can do what; both server and client check it.
- **Route middleware** — `src/proxy.ts` (Next 16 renamed Middleware to Proxy) + `src/lib/route-guards.ts`. A regex table of path → allowed roles. This is an *optimistic* perimeter check only (redirects pages, 401/403s API calls before they run) — it is not the real authorization boundary. It also redirects `/` to each role's home (`/dashboard` for ADMIN/STAFF, `/guesthouse` for GUESTHOUSE) via `homeFor()` in `policies.ts`.
- **DAL (the real boundary)** — `src/lib/dal.ts`. Every route handler must call `requireUser()` or `requireCan(permission)`. This re-reads the user from the DB on every call (not just the JWT), so deactivating a user or changing their role takes effect on their very next request, not at next login. Route handlers should be wrapped in `api(handler)`, which turns thrown `ApiError`/`ZodError` into proper JSON error responses instead of 500s.
- **FormRequest-equivalent validation** — `src/lib/validators.ts`, Zod schemas, one per endpoint shape. Call `validate(request, schema)` from the DAL inside the handler.
- **Throttle** — `src/lib/rate-limit.ts`, used on login in `src/lib/auth.ts`.

When adding a new API route or page: add its permission to `PERMISSIONS`, add its path to the `GUARDS` table in `route-guards.ts` if it needs role restriction beyond "logged in", write a Zod schema, and call `requireCan()` inside the handler. Don't rely on `proxy.ts` alone — it's a UX nicety, the DAL is what actually protects data.

Two permission tiers show up repeatedly: **quick-add during work** (e.g. `recipients.manage` — ADMIN + STAFF can register a new pastor/department/guest/district on the fly while dispensing) vs. **structural edit/delete** (`settings.manage` — ADMIN only; renaming, deactivating, or hard-deleting stockrooms/categories/districts/recipients). Follow this split for new reference-data entities rather than gating everything the same way.

### Domain model (`prisma/schema.prisma`)

- `Item` is the catalog entry (name, unit, `sellingPrice`, `avgCost`). `ItemStock` is the per-stockroom row (quantity, shelf, maxStock) — **API responses key on `ItemStock.id`, not `Item.id`**, because dispensing/adjusting/transferring all act on a specific stockroom's stock. See the DTO shape in `src/lib/types.ts` (`Item` there is really "an ItemStock joined to its Item").
- `Movement` is a single append-only ledger for every stock change (`RECEIVE`, `DISPENSE`, `SALE`, `TRANSFER_IN/OUT`, `ADJUSTMENT`, `WRITE_OFF`). Each row snapshots `unitCost`/`unitPrice` at the time — so historical reports never change when current prices change later. `purpose` (`FREE_BAPTISMAL`, `PASTOR_ISSUE`, `OFFICE_USE`, `GUESTHOUSE`, `DONATION`, `OTHER`) and free-text `note` (e.g. "Availed by: <employee>") are what reporting groups/annotates by.
- Weighted-average costing: `Item.avgCost` is recalculated only when stock is `RECEIVE`d with a known `unitCost`, using total on-hand quantity across all stockrooms. All of this logic lives in one place: `src/lib/stock.ts` (`applyStockAction`, `transferStock`) — mutate stock only through these functions, never with a raw Prisma update, or the ledger/costing will drift out of sync.
- `District` → `Recipient` (`PASTOR`/`CHURCH`/`MEMBER`/`DEPARTMENT`/`GUESTHOUSE`/`OTHER`) is the "who this dispense is for" system, surfaced via the `RecipientPicker` (`src/components/recipient-picker.tsx`) with Department/Pastor/Guest tabs. `RecipientType.MEMBER` is reused as "Employee" — the "who availed it" picker shown only for Department dispenses (stored as a `Movement.note`, not a real FK, to avoid a schema change). Full CRUD (rename/deactivate/hard-delete, guarded against dangling references) lives in `RecipientSettingsSheet` (`src/components/recipient-settings.tsx`), reachable from the picker.
- `Recipient.email` (optional, Pastor/Guest) triggers a best-effort dispense notification via `src/lib/mail.ts` (nodemailer) — see Reports section below. Never let mail failures block a dispense response.
- `Room`/`Booking` exist for the guesthouse module (role `GUESTHOUSE`), which is scaffolded (`/guesthouse` page) but not yet built out.

### API → DTO boundary

Route handlers (`src/app/api/**/route.ts`) never return Prisma models directly. They query with the includes defined in `src/lib/dto.ts` and map through `toItemDto`/`toMovementDto`/`toRecipientDto`, which control exactly which fields leave the server (e.g. `sellingPrice`/`avgCost` are stripped unless `withPricing` is passed — use this when adding endpoints a lower-privileged role might hit).

### Reports (`/api/reports/*`)

- `/api/reports/dashboard?range=day|week|month|year` — aggregates inventory totals, a dispense qty/cost time series (bucketed in JS via `src/lib/dashboard-buckets.ts`, not raw SQL group-by, since movement volume is small), category/movement-type/top-item breakdowns. Powers `/dashboard`'s charts (`src/components/charts/*` — hand-built animated bar charts, no chart library; see the `dataviz` skill before touching these).
- `/api/reports/movements-pdf?from=&to=` — generates an accounting PDF (letterhead, itemized table, totals, signature lines) via `@react-pdf/renderer` (`src/lib/pdf/movements-report.tsx`). **The letterhead logo is embedded as a base64 constant** (`src/lib/pdf/logo-base64.ts`), not read from `public/` via `fs` — Vercel serverless functions don't guarantee `public/` assets exist on the function's filesystem, and a dynamically-built `fs` path can't be traced at build time either. Follow this pattern for any future asset the PDF needs.
- Standard PDF fonts (Helvetica) have no ₱ glyph — it silently renders as "±". The PDF spells out `"PHP 1,234.00"` instead of using `Intl`'s currency-symbol formatting; the web UI (`src/lib/format.ts`) still uses ₱ since browser fonts render it fine.

### Auth

NextAuth v5 (beta) Credentials provider, JWT sessions, `bcryptjs` for hashing. `src/types/next-auth.d.ts` augments the session/JWT types with `role`. Client components read the current user via `src/lib/use-user.ts` (`useCurrentUser()` — wraps `useSession()` and exposes the same `can()` gate as the server). There is no self-registration; only `ADMIN` can create accounts, via `/admin` + `/api/admin/users`. `trustHost: true` is set in `src/lib/auth.ts` for both the Cloudflare tunnel and Vercel's proxy.

### Frontend

Next.js 16 App Router, all pages are client components (`"use client"`) that fetch through `src/lib/hooks.ts` (`useFetch`) against the JSON API — there's no server-component data fetching in the page tree currently. `src/components/shell.tsx` renders a role-specific sidebar/bottom-nav (`NAV_BY_ROLE`), keep this in sync with `route-guards.ts` when adding pages a role shouldn't see.

## Read before writing Next.js code

This project pins a Next.js version whose docs are bundled in the repo and may differ from training data (renamed APIs, e.g. Middleware → Proxy). Per `AGENTS.md`, check `node_modules/next/dist/docs/` for the relevant guide before writing Next.js-specific code (route handlers, proxy/middleware, caching, etc.).
