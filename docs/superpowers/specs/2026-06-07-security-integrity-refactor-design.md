# ZANA Security and Data Integrity Refactor Design

**Date:** 2026-06-07  
**Status:** Approved for implementation planning  
**Scope:** Server Action authorization, RBAC, transactional order creation,
order numbering, follow-up ownership, pagination, and pg-boss activation

## 1. Goals

This refactor will:

- authenticate and authorize every Server Action mutation
- link Supabase Auth users to administrator records by immutable user ID
- enforce role permissions in application code and PostgreSQL RLS
- create orders and deduct inventory in one PostgreSQL transaction
- generate unique daily order numbers safely under concurrency
- make the database the sole owner of automatic follow-up creation
- paginate and filter orders, customers, and products on the server
- replace the placeholder worker with an operational pg-boss foundation

The refactor must preserve the current routes, visual styling, forms, and core
user workflows.

## 2. Delivery Strategy

Changes will be implemented sequentially so each layer has a clear contract:

1. Add the database migration and update generated/manual database types.
2. Add the authorization shield and secure all Server Actions.
3. Replace order creation with the transactional RPC.
4. Remove application-owned automatic follow-up creation.
5. Add server-side pagination and URL-backed filters.
6. Activate and package the pg-boss worker.
7. Update the architecture documentation and verification instructions.

The migration will be committed to the repository but will not be applied to
Supabase Cloud automatically.

## 3. Identity and RBAC

### Administrator identity

Add this column to `public.admins`:

```sql
auth_user_id uuid unique references auth.users(id) on delete set null
```

Existing administrator rows will be linked to `auth.users` by case-insensitive
email in the migration:

```sql
update public.admins a
set auth_user_id = u.id
from auth.users u
where lower(a.email) = lower(u.email)
  and a.auth_user_id is null;
```

Authorization decisions will use `auth_user_id`, never user metadata or email.
Email is used only for the one-time migration.

### Roles

The existing five role names map to four permission profiles:

| Permission profile | Database roles |
|---|---|
| Full access | `admin`, `ceo` |
| Sales and CRM | `telesales` |
| Operations | `clerk` |
| Inventory | `stock` |

Unknown role values, inactive administrators, and authenticated users without a
linked administrator row are denied mutation access.

### Permission matrix

| Capability | admin/ceo | telesales | clerk | stock |
|---|---:|---:|---:|---:|
| Create/update orders and tracking | Yes | Yes | Yes | No |
| Update customers | Yes | Yes | Yes | No |
| Complete/skip CRM follow-ups | Yes | Yes | No | No |
| Create/delete ad spend | Yes | No | Yes | No |
| Update products and adjust stock | Yes | No | No | Yes |

Read access remains available to active linked administrators so the existing
dashboard and protected pages continue to work.

## 4. Authorization Shield

Create `lib/auth/shield.ts`.

The module will expose:

```ts
type AdminRole = "admin" | "ceo" | "telesales" | "clerk" | "stock";
type Capability =
  | "orders:write"
  | "customers:write"
  | "crm:write"
  | "ad-spend:write"
  | "products:write";

type AuthorizedAdmin = {
  userId: string;
  adminId: string;
  role: AdminRole;
};

export async function requireCapability(
  capability: Capability
): Promise<AuthorizedAdmin>;
```

`requireCapability()` will:

1. Create the cookie-based Supabase server client.
2. Call `supabase.auth.getUser()`.
3. Reject missing users with an `UNAUTHENTICATED` authorization error.
4. Query `admins` by `auth_user_id`.
5. Require `is_active = true`.
6. Validate the stored role against the known role union.
7. Check the role-to-capability matrix.
8. Reject denied requests with a `FORBIDDEN` authorization error.
9. Return the authenticated user ID, administrator ID, and role.

The shield will be server-only and will not import or expose the service-role
key.

Every exported mutation in `app/(protected)/**/actions.ts` must call the shield
before parsing or executing privileged data operations. Server Actions are
treated as public mutation endpoints even though the route layout is protected.

The returned `adminId` will be forwarded into mutations that record ownership,
including orders, inventory movements, and ad spend.

## 5. RLS Design

The migration will replace policies that use deprecated
`auth.role() = 'authenticated'`.

Add helper functions in a non-exposed `private` schema:

```sql
private.current_admin_role()
private.has_admin_capability(text)
```

These functions may use `security definer` only where required to read the
administrator mapping without recursive RLS. They must:

- set `search_path = ''`
- schema-qualify every relation
- require a non-null `auth.uid()`
- require `admins.is_active = true`
- return only role/capability information
- revoke execution from `public` and `anon`
- grant execution only to `authenticated`

Core table policies will use `to authenticated` and the capability helper.
Mutation policies will define both `using` and `with check` where applicable.

The application will move ordinary protected reads and mutations toward the
cookie-based Supabase client. The service-role client remains restricted to
trusted infrastructure paths such as background jobs and future verified
webhook ingestion.

The Server Action shield and RLS are independent defenses. A missing shield call
must not automatically expose mutations through the Data API.

## 6. Transactional Order Creation

### RPC contract

Create one PostgreSQL function:

```sql
public.create_order_transaction(
  p_customer jsonb,
  p_items jsonb,
  p_platform text,
  p_payment_method text,
  p_shipping_fee numeric,
  p_discount numeric,
  p_notes text,
  p_admin_id uuid
)
returns table(order_id uuid, order_number text)
```

The function will run as a single PostgreSQL transaction provided by one RPC
call. An exception at any point aborts all writes.

The RPC will:

1. Validate the calling Auth user is the active administrator represented by
   `p_admin_id` and has `orders:write`.
2. Validate platform, monetary values, customer data, and a non-empty item
   array.
3. Upsert/find the customer using normalized phone when present.
4. Allocate a concurrency-safe daily order number.
5. Insert the order with `admin_id = p_admin_id`.
6. Lock each product row with `for update`.
7. Validate that every product is active and has sufficient stock.
8. Use product rows as the authority for product name, unit cost, and selling
   price rather than trusting client-submitted snapshots.
9. Insert all order items.
10. Deduct stock and insert inventory movement rows.
11. Calculate and persist order totals consistently.
12. Return the new order ID and number.

The function will not create follow-ups. Follow-ups are created only when an
order transitions to `delivered`.

### Trigger interaction

The existing stock deduction and total synchronization triggers overlap with
the RPC. The migration will remove that overlap:

- drop `trg_deduct_stock` and `fn_deduct_stock`
- drop `trg_sync_order_totals` and `fn_sync_order_totals`

The RPC becomes the owner of order-item insertion, stock deduction, inventory
movements, and initial totals. Future order-item editing must use a dedicated
transactional RPC rather than direct inserts or updates.

Direct Data API writes to `order_items` will not be granted to normal
authenticated users.

### Function security

The RPC needs controlled access to multiple tables. If implemented as
`security definer`, it must:

- set `search_path = ''`
- schema-qualify all objects
- verify `auth.uid()` and `p_admin_id` internally
- revoke execute from `public` and `anon`
- grant execute only to `authenticated`

The application will call the RPC with the authenticated cookie-based server
client, not the service-role client.

## 7. Concurrency-Safe Order Numbers

Add a counter table:

```sql
create table public.order_daily_counters (
  order_date date primary key,
  last_value integer not null check (last_value > 0)
);
```

The order RPC will allocate a number atomically:

```sql
insert into public.order_daily_counters(order_date, last_value)
values (current_date, 1)
on conflict (order_date)
do update set last_value = public.order_daily_counters.last_value + 1
returning last_value;
```

The order number format remains:

```text
ORD-YYYYMMDD-NNN
```

The existing unique constraint on `orders.order_number` remains the final
integrity guard. The counter table will not be directly accessible through the
authenticated Data API.

## 8. Follow-Up Ownership

PostgreSQL becomes the sole owner of automatic follow-up creation.

The trigger will create follow-ups only on a real status transition:

```sql
when (
  new.status = 'delivered'
  and old.status is distinct from 'delivered'
)
```

Due dates will be based on the delivery transition date (`current_date`) rather
than the invoice date.

Add a uniqueness constraint:

```sql
unique(order_id, followup_type)
```

The trigger insertion will use `on conflict do nothing` as defense in depth.
It will copy `customer_id` and `admin_id` from the order.

Remove follow-up insertion from `lib/data/orders.ts`. `lib/data/crm.ts` remains
responsible only for querying follow-ups and recording outcomes or skipped
status.

The application status model will be normalized to the schema values:

```text
pending, confirmed, shipped, delivered, cancelled
```

Legacy UI labels may continue to display Thai or alternate friendly labels,
but persisted values must use the canonical status values.

## 9. Server-Side Pagination and Filtering

### Shared contract

Create a small server-safe pagination utility with:

```ts
type PageRequest = {
  page?: number;
  limit?: number;
  search?: string;
};

type PageResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};
```

Defaults:

- `page = 1`
- `limit = 20`
- allowed limit range: 10 to 100
- empty search is normalized to `undefined`
- invalid URL values fall back to defaults

Queries will request exact counts and use:

```ts
.range((page - 1) * limit, page * limit - 1)
```

### Orders

Supported URL parameters:

```text
page, limit, search, status, platform
```

Search covers:

- order number
- tracking number
- customer name
- customer phone

Because nested relation filtering can make counts and OR conditions difficult
through PostgREST, the implementation may add a dedicated SQL search RPC or a
searchable view using `security_invoker = true`. The selected implementation
must preserve exact pagination totals and must not fetch all rows for in-memory
filtering.

Status counts shown in the UI will be obtained from a separate aggregate query
so they describe the filtered dataset rather than only the current page.

### Customers

Supported URL parameters:

```text
page, limit, search, platform
```

Search covers normalized customer name and phone. The customer detail contract
must not require every order in the system to be nested into the paginated
customer list. Recent orders may be limited in the list response or loaded by a
separate detail query.

### Products

Supported URL parameters:

```text
page, limit, search, active
```

Search covers name and SKU. Low-stock totals will come from a separate aggregate
query rather than only the current page.

### Next.js page contract

Next.js 16 pages will await `searchParams`:

```ts
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
```

Each Server Component will normalize query parameters, call the paginated data
function, and pass a `PageResult` plus aggregate metadata to the Client
Component.

Client filter controls will update the URL using `useRouter()` and
`useSearchParams()`. Search input will be debounced. Changing search or filters
resets `page` to 1.

Pagination controls will preserve all other active URL parameters. Existing
Tailwind classes and visual tokens will be retained.

## 10. pg-boss Worker

Replace `lib/jobs/worker.js` with TypeScript modules:

```text
lib/jobs/
|-- worker.ts
|-- queues.ts
|-- handlers/
|   |-- platform-sync.ts
|   `-- followup-reminder.ts
`-- enqueue.ts
```

Initial queue names:

```text
platform-sync
followup-reminder
```

The initial handlers are infrastructure foundations:

- `platform-sync` accepts a typed platform/order reference and records a
  structured log until webhook ingestion is implemented.
- `followup-reminder` queries due pending follow-ups and records a structured
  summary. It does not send LINE messages until credentials and integration
  code exist.

The worker will:

1. Validate `PGBOSS_DATABASE_URL`.
2. Create and start a `PgBoss` instance.
3. Register queues and handlers.
4. Register an idempotent daily schedule for `followup-reminder`.
5. Handle `SIGTERM` and `SIGINT` with graceful shutdown.
6. Log startup, job completion, failures, and shutdown without secrets.
7. Exit non-zero if initialization fails.

### Build packaging

Next.js standalone output does not compile an arbitrary worker entry point.
Add a dedicated worker TypeScript build configuration that emits CommonJS or
Node-compatible ESM into `dist/jobs`.

The Docker builder stage will compile both:

- the Next.js standalone application
- the pg-boss worker

The runner image will include the compiled worker and production dependencies
required by it. Docker Compose will run:

```text
node dist/jobs/worker.js
```

No runtime TypeScript compiler will be installed in the production image.

## 11. Type Safety

`lib/supabase/types.ts` will be updated for:

- `admins.auth_user_id`
- `order_daily_counters`
- `create_order_transaction` RPC arguments and return type
- any pagination/search RPC introduced during implementation
- the follow-up uniqueness and status contract where represented in types

Application input types will stop accepting authoritative `product_name`,
`unit_cost`, or `unit_price` for new orders. The browser will submit product ID
and quantity; the database will resolve authoritative commercial values.

Zod schemas will validate Server Action/RPC input before database calls. The
database will repeat critical integrity checks.

## 12. Error Handling

Authorization errors will use stable codes:

```text
UNAUTHENTICATED
FORBIDDEN
ADMIN_NOT_LINKED
ADMIN_INACTIVE
```

Order RPC errors will use clear PostgreSQL messages or error codes for:

- empty order
- invalid quantity
- unknown/inactive product
- insufficient stock
- invalid monetary input
- unauthorized administrator

Server Actions will translate expected errors into safe user-facing messages.
Raw database details, SQL text, connection strings, and keys will not be sent
to Client Components.

## 13. Verification Strategy

### Static verification

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- dedicated worker TypeScript build

### Authorization tests

For each role, verify every capability in the matrix:

- allowed actions succeed
- denied actions return `FORBIDDEN`
- signed-out actions return `UNAUTHENTICATED`
- inactive and unlinked administrators are denied
- direct Data API mutation attempts are blocked by RLS

### Transaction tests

- valid order creates customer/order/items/movements and deducts stock
- insufficient stock rolls back every write
- invalid product rolls back every write
- concurrent orders cannot oversell a locked product
- concurrent orders receive unique order numbers
- client-supplied price/cost values cannot alter persisted totals

### Follow-up tests

- creating a pending order creates no follow-ups
- transition to delivered creates exactly four follow-ups
- repeated delivered updates do not create duplicates
- leaving and returning to delivered still respects uniqueness

### Pagination tests

- first, middle, last, empty, and out-of-range pages
- exact counts and page counts
- search and filters operate across the full database dataset
- URL controls preserve filters while paging
- mutations refresh the current URL-backed page

### Worker tests

- worker starts with a valid connection
- worker exits on missing/invalid configuration
- queues and schedule are registered idempotently
- sample jobs execute once and failures are recorded
- SIGTERM produces graceful shutdown

## 14. Rollout and Compatibility

The code deployment depends on the migration. Recommended production order:

1. Back up the database.
2. Apply the reviewed migration.
3. Verify administrator identity links.
4. Deploy the application and worker image.
5. Run RBAC smoke tests for one account per role.
6. Run one low-value transactional order test.
7. Monitor Supabase logs, application logs, and pg-boss failures.

Before application deployment, every active user who needs mutation access must
have a linked `admins.auth_user_id`.

The migration must be written to tolerate existing schema objects and data
where practical. It must fail explicitly if duplicate administrator emails,
invalid roles, duplicate follow-ups, or other data prevent a safe constraint
from being added.

## 15. Out of Scope

- Applying the migration to Supabase Cloud
- TikTok or Shopee webhook endpoints
- LINE notification delivery
- Realtime UI subscriptions
- A UI for managing users or roles
- HTTPS/Nginx configuration
- Broad visual redesign
