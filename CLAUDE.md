# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Northern Luzon Mission (NLM) inventory, dispensing, and guesthouse system. Tracks Bible books, baptismal materials, office supplies, and other stock across multiple stockrooms; dispenses/sells it with a full costed movement ledger; and (in progress) manages guesthouse room bookings under a separate role.

Deployment target: a single office PC running XAMPP MySQL, exposed via a Cloudflare tunnel — not a multi-instance cloud deployment. This shapes some choices (e.g. the in-memory login rate limiter in `src/lib/rate-limit.ts`, `trustHost: true` in NextAuth for the tunnel's Host header).

> `README.md` in this repo describes an earlier/aspirational architecture (Neon Postgres, NextAuth v4, `dashboard/*` routes, different models). It does not match the current code — trust the source, not the README.

## Commands

```bash
npm run dev              # dev server
npm run build             # production build (also runs TypeScript checks — treat build failures as real errors)
npm run start             # run the production build
npm run lint              # eslint

npx prisma migrate dev --name <name>   # create/apply a migration after editing prisma/schema.prisma
npx prisma db seed                     # re-run prisma/seed.ts (also runs automatically after migrate dev)
npx prisma studio                      # inspect the MySQL data directly
```

There is no test runner configured in this project.

## Architecture

### Security model — deliberately Laravel-shaped

The user has a Laravel/Livewire background, so the auth/authorization layers intentionally mirror Laravel's terms. When adding a feature, follow this same structure rather than inventing a new pattern:

- **Gates** — `src/lib/policies.ts`. One `PERMISSIONS` map of `"resource.action" → Role[]`, checked via `can(role, permission)`. This is the single source of truth for who can do what; both server and client check it.
- **Route middleware** — `src/proxy.ts` (Next 16 renamed Middleware to Proxy) + `src/lib/route-guards.ts`. A regex table of path → allowed roles. This is an *optimistic* perimeter check only (redirects pages, 401/403s API calls before they run) — it is not the real authorization boundary.
- **DAL (the real boundary)** — `src/lib/dal.ts`. Every route handler must call `requireUser()` or `requireCan(permission)`. This re-reads the user from the DB on every call (not just the JWT), so deactivating a user or changing their role takes effect on their very next request, not at next login. Route handlers should be wrapped in `api(handler)`, which turns thrown `ApiError`/`ZodError` into proper JSON error responses instead of 500s.
- **FormRequest-equivalent validation** — `src/lib/validators.ts`, Zod schemas, one per endpoint shape. Call `validate(request, schema)` from the DAL inside the handler.
- **Throttle** — `src/lib/rate-limit.ts`, used on login in `src/lib/auth.ts`.

When adding a new API route or page: add its permission to `PERMISSIONS`, add its path to the `GUARDS` table in `route-guards.ts` if it needs role restriction beyond "logged in", write a Zod schema, and call `requireCan()` inside the handler. Don't rely on `proxy.ts` alone — it's a UX nicety, the DAL is what actually protects data.

### Domain model (`prisma/schema.prisma`)

- `Item` is the catalog entry (name, unit, `sellingPrice`, `avgCost`). `ItemStock` is the per-stockroom row (quantity, shelf, maxStock) — **API responses key on `ItemStock.id`, not `Item.id`**, because dispensing/adjusting/transferring all act on a specific stockroom's stock. See the DTO shape in `src/lib/types.ts` (`Item` there is really "an ItemStock joined to its Item").
- `Movement` is a single append-only ledger for every stock change (`RECEIVE`, `DISPENSE`, `SALE`, `TRANSFER_IN/OUT`, `ADJUSTMENT`, `WRITE_OFF`). Each row snapshots `unitCost`/`unitPrice` at the time — so historical reports never change when current prices change later. `purpose` (`FREE_BAPTISMAL`, `PASTOR_ISSUE`, `OFFICE_USE`, `GUESTHOUSE`, `DONATION`, `OTHER`) is what future costing/reporting will group by.
- Weighted-average costing: `Item.avgCost` is recalculated only when stock is `RECEIVE`d with a known `unitCost`, using total on-hand quantity across all stockrooms. All of this logic lives in one place: `src/lib/stock.ts` (`applyStockAction`, `transferStock`) — mutate stock only through these functions, never with a raw Prisma update, or the ledger/costing will drift out of sync.
- `District` → `Recipient` (pastors/churches/departments) supports "who received this" reporting per district.
- `Room`/`Booking` exist for the guesthouse module (role `GUESTHOUSE`), which is scaffolded (`/guesthouse` page) but not yet built out.

### API → DTO boundary

Route handlers (`src/app/api/**/route.ts`) never return Prisma models directly. They query with the includes defined in `src/lib/dto.ts` and map through `toItemDto`/`toMovementDto`, which control exactly which fields leave the server (e.g. `sellingPrice`/`avgCost` are stripped unless `withPricing` is passed — use this when adding endpoints a lower-privileged role might hit).

### Auth

NextAuth v5 (beta) Credentials provider, JWT sessions, `bcryptjs` for hashing. `src/types/next-auth.d.ts` augments the session/JWT types with `role`. Client components read the current user via `src/lib/use-user.ts` (`useCurrentUser()` — wraps `useSession()` and exposes the same `can()` gate as the server). There is no self-registration; only `ADMIN` can create accounts, via `/admin` + `/api/admin/users`.

### Frontend

Next.js 16 App Router, all pages are client components (`"use client"`) that fetch through `src/lib/hooks.ts` (`useFetch`) against the JSON API — there's no server-component data fetching in the page tree currently. `src/components/shell.tsx` renders a role-specific sidebar/bottom-nav (`NAV_BY_ROLE`), keep this in sync with `route-guards.ts` when adding pages a role shouldn't see.

## Read before writing Next.js code

This project pins a Next.js version whose docs are bundled in the repo and may differ from training data (renamed APIs, e.g. Middleware → Proxy). Per `AGENTS.md`, check `node_modules/next/dist/docs/` for the relevant guide before writing Next.js-specific code (route handlers, proxy/middleware, caching, etc.).
