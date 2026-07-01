# NLM Inventory Management System

Northern Luzon Mission (NLM) Inventory & Guesthouse Management System.

Built with Next.js 16 (App Router), Prisma 7, Neon Postgres, NextAuth.js, and Tailwind CSS v4.

## Setup

### 1. Environment Variables

Copy the values from `.env.local` — this file is pre-configured with placeholders:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `NEXTAUTH_SECRET` | Random secret (generate with `openssl rand -base64 32`) |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` |

**For Neon Postgres (free tier):**
1. Go to https://neon.tech
2. Create a free account and project
3. Copy the connection string from the dashboard
4. Paste it as the `DATABASE_URL` value in `.env.local`

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Migrations

```bash
npx prisma migrate dev --name init
```

This creates the database tables for: User, Category, Item, StockMovement, Room.

### 4. Seed the Database

```bash
npx prisma db seed
```

This creates default accounts, categories, rooms, and sample items.

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Default Login Credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@nlm.org` | `admin123` |
| **Staff** | `staff@nlm.org` | `staff123` |
| **Guesthouse** | `guest@nlm.org` | `guest123` |

**⚠️ Change these passwords immediately after first login.**

---

## Role-Based Access

| Feature | ADMIN | STAFF | GUESTHOUSE |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ |
| Inventory (items, stock) | ✅ | ✅ | ❌ |
| Guesthouse (rooms) | ✅ | ❌ | ✅ |
| User Management | ✅ | ❌ | ❌ |

---

## Architecture

### Tech Stack

- **Framework:** Next.js 16.2 (App Router)
- **Database:** Neon Postgres via Prisma 7
- **Auth:** NextAuth.js v4 (Credentials provider, JWT sessions)
- **UI:** Tailwind CSS v4 + shadcn/ui v4 (base-nova style)
- **Icons:** Lucide React

### Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Login page
│   ├── layout.tsx                  # Root layout (SessionProvider)
│   ├── proxy.ts                    # Route protection (Next.js 16 proxy)
│   ├── api/
│   │   ├── auth/[...nextauth]/     # NextAuth handler
│   │   ├── users/                  # Users CRUD (admin only)
│   │   ├── items/                  # Items CRUD
│   │   ├── categories/             # Categories list
│   │   ├── movements/              # Stock movements
│   │   ├── rooms/                  # Rooms CRUD
│   │   └── dashboard/              # Dashboard stats
│   └── dashboard/
│       ├── layout.tsx              # Dashboard layout with sidebar
│       ├── page.tsx                # Dashboard home (stats + recent movements)
│       ├── users/page.tsx          # User management (admin)
│       ├── inventory/page.tsx      # Inventory management
│       └── guesthouse/page.tsx     # Guesthouse room management
├── components/
│   ├── ui/                         # shadcn UI primitives
│   ├── SessionProvider.tsx         # NextAuth session wrapper
│   └── DashboardSidebar.tsx        # Sidebar with role-based nav
├── lib/
│   ├── prisma.ts                   # Prisma singleton
│   ├── auth.ts                     # NextAuth config
│   └── auth-guard.ts               # Server-side auth helpers
└── types/
    └── next-auth.d.ts              # Extended session types
```

### Database Models

- **User** — Authentication & role-based access (ADMIN/STAFF/GUESTHOUSE)
- **Category** — Item categorization (ASSET/CONSUMABLE/PERISHABLE)
- **Item** — Inventory items with stock, location, expiry, serial numbers
- **StockMovement** — Audit log for IN/OUT/ADJUSTMENT transactions
- **Room** — Guesthouse room management

### Auth Flow

1. Login page → `signIn("credentials")` → validates against DB (bcrypt)
2. JWT token stores user id + role
3. `proxy.ts` guards all `/dashboard/*` routes, redirects to `/` if unauthenticated
4. Server components use `getServerSession()` for role-based access
5. Client components use `useSession()` for role-based UI rendering

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database |
| `npm run db:reset` | Reset database & re-run migrations + seed |
| `npm run db:studio` | Open Prisma Studio |

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/dashboard` | Dashboard stats | All roles |
| GET | `/api/users` | List users | ADMIN |
| POST | `/api/users` | Create user | ADMIN |
| PATCH | `/api/users/[id]` | Update user | ADMIN |
| DELETE | `/api/users/[id]` | Deactivate user | ADMIN |
| GET | `/api/items` | List items (filters: categoryId, lowStock, expiring) | All roles |
| POST | `/api/items` | Create item | ADMIN/STAFF |
| PATCH | `/api/items/[id]` | Update item | ADMIN/STAFF |
| DELETE | `/api/items/[id]` | Delete item | ADMIN |
| GET | `/api/categories` | List categories | All roles |
| GET | `/api/movements` | List movements (filter: itemId) | All roles |
| POST | `/api/movements` | Create movement (IN/OUT/ADJUSTMENT) | ADMIN/STAFF |
| GET | `/api/rooms` | List rooms | All roles |
| PATCH | `/api/rooms/[id]` | Update room status | All roles |
"# Projectnlminventory" 
