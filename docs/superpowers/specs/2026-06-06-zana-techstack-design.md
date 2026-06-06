# ZANA - Current Architecture

**Last updated:** 2026-06-07
**Project:** ZANA E-Commerce & CRM  
**Status:** Reflects the current repository implementation

---

## 1. System Context

ZANA is a Thai-language internal web application for managing online sales and
customer follow-ups across TikTok, Facebook, LINE, and Shopee.

The current application provides:

- Supabase email/password authentication
- Sales dashboard and monthly platform breakdown
- Order creation, status updates, and shipment tracking
- Customer records
- Product, price, and inventory management
- CRM follow-up tracking
- Advertising spend records
- Responsive navigation, toast notifications, and confirmation dialogs

The application is designed for self-hosting on a VPS. Supabase Cloud provides
authentication and PostgreSQL storage.

---

## 2. Architecture Overview

```text
Browser
  |
  | HTTPS/HTTP
  v
Nginx
  |
  | reverse proxy
  v
Next.js 16 application
  |-- App Router and Server Components
  |-- Client Components for interactive screens
  |-- Server Actions for mutations
  |-- Supabase SSR authentication
  |
  | authenticated Supabase SSR client
  v
Supabase Cloud
  |-- Auth
  |-- PostgreSQL
  |-- Row Level Security
  `-- Database triggers
```

The normal page request flow is:

```text
middleware auth check
  -> protected layout auth check
  -> async page Server Component
  -> lib/data query
  -> authenticated Supabase SSR client and RLS
  -> data passed to Client Component as props
```

The mutation flow is:

```text
Client Component
  -> Server Action
  -> RBAC capability shield
  -> lib/data mutation
  -> authenticated Supabase SSR client and RLS/RPC
  -> revalidatePath()
  -> router.refresh()
```

TanStack Query and Zustand are installed. Zustand is used by the global
feedback UI. TanStack Query is not part of the current page data flow.

---

## 3. Technology Stack

Versions below match `package.json`.

| Layer | Technology | Current version/use |
|---|---|---|
| Framework | Next.js App Router | 16.2.7 |
| UI runtime | React / React DOM | 19.2.4 |
| Language | TypeScript | 5.x, strict mode |
| Styling | Tailwind CSS | 4.x |
| Component foundation | shadcn/ui + Radix Slot | shadcn 4.10.0 |
| Icons | Lucide React | 1.17.0 |
| Charts | Recharts | 3.8.1 |
| Authentication | Supabase Auth with `@supabase/ssr` | SSR cookie sessions |
| Database access | `@supabase/supabase-js` | 2.107.0 |
| Environment validation | `@t3-oss/env-nextjs` + Zod | Build/runtime validation |
| Client UI state | Zustand | Global toast and confirm state |
| Server-state library | TanStack Query | Installed, currently unused |
| Job library | pg-boss | Typed worker, queues, and daily schedule |
| Deployment | Docker Compose + Nginx | VPS target |
| CI/CD | GitHub Actions + SSH | Deploys pushes to `master` |

Fonts are loaded through `next/font`: Geist, Geist Mono, and IBM Plex Sans Thai.

---

## 4. Repository Structure

```text
zana/
|-- app/
|   |-- (auth)/
|   |   `-- login/
|   |       |-- actions.ts
|   |       `-- page.tsx
|   |-- (protected)/
|   |   |-- layout.tsx
|   |   |-- dashboard/
|   |   |-- orders/
|   |   |-- crm/
|   |   |-- customers/
|   |   |-- products/
|   |   `-- ad-spend/
|   |-- globals.css
|   |-- layout.tsx
|   `-- page.tsx
|-- components/
|   |-- sidebar.tsx
|   `-- ui/
|       |-- button.tsx
|       `-- feedback.tsx
|-- lib/
|   |-- data/
|   |   |-- dashboard.ts
|   |   |-- orders.ts
|   |   |-- crm.ts
|   |   |-- customers.ts
|   |   |-- products.ts
|   |   `-- adspend.ts
|   |-- jobs/
|   |   |-- worker.ts
|   |   |-- queues.ts
|   |   |-- enqueue.ts
|   |   `-- handlers/
|   |-- supabase/
|   |   |-- client.ts
|   |   |-- server.ts
|   |   `-- types.ts
|   `-- utils.ts
|-- middleware.ts
|-- env.ts
|-- zana_supabase_schema.sql
|-- Dockerfile
|-- docker-compose.yml
|-- nginx.conf
`-- .github/workflows/deploy.yml
```

Each protected feature generally follows this structure:

```text
feature/
|-- page.tsx             # Server Component: fetches initial data
|-- actions.ts           # Server Actions: mutation boundary and revalidation
`-- feature-client.tsx   # Client Component: forms, filters, modals, charts
```

---

## 5. Rendering and Data Access

### Server Components

Protected `page.tsx` files are asynchronous Server Components. They call
functions in `lib/data/*` and pass the result to a feature-specific Client
Component.

This implementation does not expose a separate REST or GraphQL API for the
internal application screens.

### Data Layer

`lib/data/*` owns Supabase queries and mutations:

| Module | Responsibility |
|---|---|
| `dashboard.ts` | Daily/monthly KPIs, charts, platform totals, low stock |
| `orders.ts` | Orders, order creation, tracking, statuses, order products |
| `crm.ts` | Follow-up queries, completion, and skipping |
| `customers.ts` | Customer list and customer updates |
| `products.ts` | Product updates and inventory adjustments |
| `adspend.ts` | Advertising spend queries, creation, and deletion |

Application data modules use the cookie-based Supabase SSR client and are
subject to RLS. The service-role key is reserved for trusted infrastructure,
including the background follow-up summary worker.

### Server Actions

Feature `actions.ts` files:

1. Verify the authenticated administrator and required RBAC capability.
2. Validate input with Zod.
3. Call the matching `lib/data` mutation.
4. Revalidate affected routes with `revalidatePath()`.
5. Return data or allow a safe exception to propagate.

Client Components call `router.refresh()` after successful actions so the
Server Component is rendered again with current database data.

### Client State

Local React state manages forms, filters, modals, and inline editing.

`components/ui/feedback.tsx` uses a Zustand store to provide:

- success, error, and informational toasts
- promise-based confirmation dialogs

---

## 6. Authentication and Authorization

Authentication uses Supabase email/password sessions stored in cookies.

There are two authentication checks:

1. `middleware.ts` refreshes Supabase session cookies and redirects:
   - unauthenticated protected requests to `/login`
   - authenticated `/login` requests to `/dashboard`
2. `app/(protected)/layout.tsx` calls `supabase.auth.getUser()` and redirects
   unauthenticated users to `/login`.

Protected routes are:

- `/dashboard`
- `/orders`
- `/crm`
- `/customers`
- `/products`
- `/ad-spend`

`admins.auth_user_id` links an administrator to `auth.users.id`. Server Actions
and RLS enforce capability profiles for `admin`/`ceo`, `telesales`, `clerk`,
and `stock`. Inactive, unlinked, and unknown-role accounts cannot mutate data.

---

## 7. Database Model

The schema is defined in `zana_supabase_schema.sql`. TypeScript table types are
kept in `lib/supabase/types.ts`.

### Main tables

| Table | Purpose |
|---|---|
| `admins` | Internal administrator records |
| `customers` | Customer identity, contact details, platform, tags, notes |
| `products` | SKU, category, cost, selling price, stock, active state |
| `orders` | Order header, totals, platform, status, tracking |
| `order_items` | Product snapshots and quantities for an order |
| `inventory_movements` | Stock adjustment history |
| `followups` | Scheduled CRM contacts and outcomes |
| `ad_spend` | Daily advertising cost by platform |

### Relationships

```text
customers 1 --- n orders
admins    1 --- n orders
orders    1 --- n order_items
products  1 --- n order_items
products  1 --- n inventory_movements
orders    1 --- n inventory_movements
customers 1 --- n followups
orders    1 --- n followups
admins    1 --- n followups
```

### Database automation

Order creation uses `create_order_transaction`, an authenticated PostgreSQL RPC
that allocates a locked daily order number, creates the customer/order/items,
deducts stock, records inventory movements, and calculates totals atomically.

A database trigger is the sole owner of automatic follow-ups. It creates unique
3, 7, 14, and 30-day tasks only when an order transitions to `delivered`.

---

## 8. UI Architecture

The protected layout contains:

- responsive fixed/drawer sidebar
- main content area
- globally mounted feedback UI

The visual system is implemented in `app/globals.css` using:

- Tailwind CSS 4 theme variables
- shadcn semantic color variables
- custom rose-gold and warm cream tokens
- shared `glass`, `glass-strong`, `btn-primary`, and `input-luxe` classes
- light and dark token definitions

Dark-mode tokens exist, but there is currently no theme switcher that applies
the `dark` class.

Tables and forms remain feature-specific rather than being composed from a
large shared component library.

---

## 9. Environment Configuration

`env.ts` validates these variables:

| Variable | Visibility | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client/server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client/server | Browser and SSR auth client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged data-layer access |
| `PGBOSS_DATABASE_URL` | Server only | Planned pg-boss connection |

`.env.example` documents the same variables.

The service-role key must never be imported into Client Components or returned
to the browser.

---

## 10. Build and Deployment

### Next.js build

`next.config.ts` sets `output: "standalone"`.

The multi-stage Dockerfile:

1. installs dependencies with `npm ci`
2. runs `npm run build`
3. copies the standalone Next.js server and static assets
4. runs the app as an unprivileged `nextjs` user on port 3000

### Docker Compose

Configured services:

| Service | Current role |
|---|---|
| `app` | Builds and runs the Next.js standalone server |
| `nginx` | Reverse proxies requests to `app:3000` |
| `jobs` | Compiled pg-boss worker container |
| `uptime-kuma` | Monitoring service on port 3001 |

`nginx.conf` currently listens on port 80 and adds basic security headers. The
Compose file also maps port 443 and mounts `./ssl`, but TLS is not configured
in the current Nginx server block.

The worker registers `platform-sync` and `followup-reminder` queues, schedules a
daily Bangkok-time follow-up summary, and shuts down gracefully. Platform sync
and notification delivery remain placeholders until external integrations are
implemented.

### CI/CD

`.github/workflows/deploy.yml` runs for pushes to `master`:

1. check out the repository
2. install Node.js 20 dependencies
3. run `npx tsc --noEmit`
4. run the production Next.js build
5. connect to the VPS over SSH
6. pull `master`
7. generate `.env.production` from GitHub secrets
8. run `docker compose up -d --build`

---

## 11. Current Constraints and Technical Risks

These describe the current implementation, not completed features:

1. **Migration deployment dependency**
   The application changes require
   `supabase/migrations/20260606182614_security_integrity_refactor.sql` to be
   reviewed and applied before deploying the new application build.

2. **Existing administrator links**
   Every active operator needs a matching Auth email during migration so
   `admins.auth_user_id` can be populated.

3. **Customer phone normalization**
   The order RPC normalizes phone numbers while looking up existing customers,
   but the schema does not yet enforce a unique normalized-phone constraint.

4. **External integrations are roadmap only**
   There are no webhook routes or TikTok, Shopee, or LINE integration modules.

5. **TLS configuration is incomplete**
   Port and certificate mounts exist in Compose, but Nginx has no HTTPS server
   block.

---

## 12. Implemented and Planned Scope

### Implemented

- Supabase login/logout and protected routes
- Dashboard backed by Supabase data
- Orders and order items
- Customer management
- Product and inventory management
- CRM follow-ups
- Advertising spend management
- RBAC-protected Server Actions and RLS
- Atomic order creation and daily order counters
- Atomic manual stock adjustments
- Delivery-triggered unique follow-ups
- URL-backed server pagination and filtering
- pg-boss queues and scheduled worker foundation
- Responsive sidebar and shared feedback UI
- Docker image, Compose services, Nginx proxy, and VPS deployment workflow

### Not implemented

- TikTok Shop webhook ingestion
- Shopee webhook ingestion
- LINE notifications
- Supabase Realtime subscriptions
- Configured HTTPS termination

Future plans must treat this document and the current source tree as the
baseline. Older plan documents describe intended work and may not reflect the
implemented architecture.
