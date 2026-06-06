# ZANA Kanban and Integrations Implementation Plan

## Implementation Status

Implemented and verified on June 7, 2026.

Applied migrations:

- `20260606200247_rbac_kanban_integrations.sql`
- `20260606200420_fix_kanban_timestamp_precision.sql`
- `20260606200658_integration_performance_hardening.sql`
- `20260606200903_kanban_defaults_and_status_sync.sql`
- `20260606201036_drop_legacy_external_order_constraint.sql`
- `20260606201117_grant_status_stage_updates.sql`

The production implementation uses database-backed capabilities, transactional
Kanban RPCs, TanStack Query optimistic updates, an idempotent platform webhook
inbox, pg-boss workers, and authenticated Telegram action tokens. The SQL below
is the original design blueprint; the migration files above are the canonical
deployed schema.

## 1. Scope and Decisions

This plan extends the current Next.js 16, React 19, Supabase, and pg-boss
architecture without replacing the security and transactional order work already
implemented.

Primary decisions:

- Keep the current single role per administrator. Normalize capabilities only if
  users later require multiple simultaneous roles.
- Use `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities`.
- Use TanStack Query as the server-state and optimistic-update owner. Do not
  duplicate board records in Zustand.
- Use domain columns as the source of truth. Do not create a generic board table
  that can disagree with orders, customers, or follow-ups.
- Persist every move through a transactional PostgreSQL RPC.
- Receive external events through an idempotent webhook inbox and process them
  asynchronously with pg-boss.
- Authenticate Telegram callbacks with the webhook secret, an administrator
  mapping, and a short-lived single-use action token.

## 2. Database Schema Migrations

Create this as a new migration after
`20260606191722_backfill_order_daily_counters.sql`.

```sql
begin;

-- ============================================================
-- RBAC
-- ============================================================

alter table public.admins
  drop constraint if exists admins_role_check;

update public.admins
set role = case role
  when 'ceo' then 'owner'
  when 'telesales' then 'sales'
  when 'clerk' then 'sales'
  when 'stock' then 'inventory'
  else role
end;

alter table public.admins
  add constraint admins_role_check
  check (role in ('owner', 'admin', 'sales', 'crm', 'inventory'));

create table if not exists private.role_capabilities (
  role text not null,
  capability text not null,
  primary key (role, capability),
  constraint role_capabilities_role_check
    check (role in ('owner', 'admin', 'sales', 'crm', 'inventory'))
);

insert into private.role_capabilities (role, capability)
values
  ('owner', 'dashboard:financial'),
  ('owner', 'dashboard:sales'),
  ('owner', 'dashboard:crm'),
  ('owner', 'dashboard:inventory'),
  ('owner', 'orders:write'),
  ('owner', 'customers:write'),
  ('owner', 'crm:write'),
  ('owner', 'ad-spend:write'),
  ('owner', 'products:write'),
  ('owner', 'kanban:orders'),
  ('owner', 'kanban:customers'),
  ('owner', 'kanban:followups'),
  ('owner', 'integrations:manage'),
  ('admin', 'dashboard:financial'),
  ('admin', 'dashboard:sales'),
  ('admin', 'dashboard:crm'),
  ('admin', 'dashboard:inventory'),
  ('admin', 'orders:write'),
  ('admin', 'customers:write'),
  ('admin', 'crm:write'),
  ('admin', 'ad-spend:write'),
  ('admin', 'products:write'),
  ('admin', 'kanban:orders'),
  ('admin', 'kanban:customers'),
  ('admin', 'kanban:followups'),
  ('admin', 'integrations:manage'),
  ('sales', 'dashboard:sales'),
  ('sales', 'orders:write'),
  ('sales', 'customers:write'),
  ('sales', 'kanban:orders'),
  ('sales', 'kanban:customers'),
  ('crm', 'dashboard:crm'),
  ('crm', 'customers:write'),
  ('crm', 'crm:write'),
  ('crm', 'kanban:customers'),
  ('crm', 'kanban:followups'),
  ('inventory', 'dashboard:inventory'),
  ('inventory', 'products:write'),
  ('inventory', 'kanban:orders')
on conflict do nothing;

create or replace function private.has_admin_capability(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins as admin
    join private.role_capabilities as permission
      on permission.role = admin.role
    where admin.auth_user_id = auth.uid()
      and admin.is_active = true
      and permission.capability = p_capability
  );
$$;

revoke all on table private.role_capabilities from public, anon, authenticated;
revoke execute on function private.has_admin_capability(text)
  from public, anon;
grant execute on function private.has_admin_capability(text)
  to authenticated;

-- ============================================================
-- KANBAN STATE
-- ============================================================

alter table public.orders
  add column if not exists kanban_stage text,
  add column if not exists sort_order bigint not null default 1000,
  add column if not exists status_changed_at timestamptz not null default now();

update public.orders
set kanban_stage = status
where kanban_stage is null;

alter table public.orders
  alter column kanban_stage set not null,
  add constraint orders_kanban_stage_check
  check (
    kanban_stage in
      ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled')
  );

alter table public.customers
  add column if not exists kanban_stage text not null default 'lead',
  add column if not exists sort_order bigint not null default 1000;

alter table public.customers
  add constraint customers_kanban_stage_check
  check (
    kanban_stage in
      ('lead', 'contacted', 'qualified', 'customer', 'repeat', 'inactive')
  );

alter table public.followups
  add column if not exists kanban_stage text,
  add column if not exists sort_order bigint not null default 1000;

update public.followups
set kanban_stage = case status
  when 'done' then 'done'
  when 'cancelled' then 'cancelled'
  else 'todo'
end
where kanban_stage is null;

alter table public.followups
  alter column kanban_stage set not null,
  add constraint followups_kanban_stage_check
  check (kanban_stage in ('todo', 'in_progress', 'waiting', 'done', 'cancelled'));

create index if not exists orders_kanban_order_idx
  on public.orders (kanban_stage, sort_order, updated_at desc);

create index if not exists customers_kanban_order_idx
  on public.customers (kanban_stage, sort_order, updated_at desc);

create index if not exists followups_kanban_order_idx
  on public.followups (kanban_stage, sort_order, due_date);

create table if not exists public.workflow_transition_log (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null
    check (entity_type in ('order', 'customer', 'followup')),
  entity_id uuid not null,
  from_stage text,
  to_stage text not null,
  from_sort_order bigint,
  to_sort_order bigint not null,
  actor_admin_id uuid references public.admins(id) on delete set null,
  source text not null default 'web'
    check (source in ('web', 'telegram', 'platform', 'system')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_transition_entity_idx
  on public.workflow_transition_log (entity_type, entity_id, created_at desc);

alter table public.workflow_transition_log enable row level security;

create policy workflow_transition_select_active_admin
  on public.workflow_transition_log
  for select
  to authenticated
  using (private.current_admin_role() is not null);

-- Implement one RPC per domain so validation remains explicit.
-- The order RPC is shown fully; customer/follow-up RPCs follow the same pattern.
create or replace function public.move_order_kanban_card(
  p_order_id uuid,
  p_to_stage text,
  p_sort_order bigint,
  p_admin_id uuid,
  p_source text default 'web'
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_from_stage text;
  v_from_sort_order bigint;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;

  if not private.has_admin_capability('kanban:orders') then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.admins as admin
    where admin.id = p_admin_id
      and admin.auth_user_id = auth.uid()
      and admin.is_active = true
  ) then
    raise exception using errcode = '42501',
      message = 'ADMIN_IDENTITY_MISMATCH';
  end if;

  if p_to_stage not in
    ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled')
  then
    raise exception using errcode = '22023', message = 'INVALID_ORDER_STAGE';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  v_from_stage := v_order.kanban_stage;
  v_from_sort_order := v_order.sort_order;

  -- Disallow reopening final orders without a separate privileged workflow.
  if v_from_stage in ('delivered', 'cancelled')
    and p_to_stage is distinct from v_from_stage
  then
    raise exception using errcode = '22023',
      message = 'FINAL_ORDER_STAGE';
  end if;

  update public.orders
  set kanban_stage = p_to_stage,
      status = case
        when p_to_stage = 'packed' then 'confirmed'
        else p_to_stage
      end,
      sort_order = p_sort_order,
      status_changed_at = case
        when kanban_stage is distinct from p_to_stage then now()
        else status_changed_at
      end,
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.workflow_transition_log (
    entity_type,
    entity_id,
    from_stage,
    to_stage,
    from_sort_order,
    to_sort_order,
    actor_admin_id,
    source
  )
  values (
    'order',
    p_order_id,
    v_from_stage,
    p_to_stage,
    v_from_sort_order,
    p_sort_order,
    p_admin_id,
    p_source
  );

  return v_order;
end;
$$;

revoke execute on function public.move_order_kanban_card(
  uuid, text, bigint, uuid, text
) from public, anon;
grant execute on function public.move_order_kanban_card(
  uuid, text, bigint, uuid, text
) to authenticated;

-- ============================================================
-- WEBHOOK INBOX / PLATFORM MAPPINGS
-- ============================================================

create table if not exists public.platform_accounts (
  id uuid primary key default uuid_generate_v4(),
  platform text not null check (platform in ('tiktok', 'shopee', 'facebook')),
  external_account_id text not null,
  display_name text not null,
  credentials_ciphertext text,
  webhook_secret_ciphertext text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_account_id)
);

create table if not exists public.platform_webhook_events (
  id uuid primary key default uuid_generate_v4(),
  platform text not null check (platform in ('tiktok', 'shopee', 'facebook')),
  platform_account_id uuid references public.platform_accounts(id),
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  headers jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'processed', 'failed')),
  attempts integer not null default 0,
  processed_at timestamptz,
  last_error text,
  unique (platform, external_event_id)
);

create index if not exists platform_webhook_pending_idx
  on public.platform_webhook_events (processing_status, received_at);

create table if not exists public.platform_external_orders (
  id uuid primary key default uuid_generate_v4(),
  platform text not null check (platform in ('tiktok', 'shopee', 'facebook')),
  platform_account_id uuid references public.platform_accounts(id),
  external_order_id text not null,
  order_id uuid references public.orders(id) on delete set null,
  external_status text,
  last_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  unique (platform, platform_account_id, external_order_id)
);

-- These integration tables are server/worker-only.
alter table public.platform_accounts enable row level security;
alter table public.platform_webhook_events enable row level security;
alter table public.platform_external_orders enable row level security;

revoke all on public.platform_accounts from anon, authenticated;
revoke all on public.platform_webhook_events from anon, authenticated;
revoke all on public.platform_external_orders from anon, authenticated;

-- ============================================================
-- TELEGRAM
-- ============================================================

alter table public.admins
  add column if not exists telegram_user_id bigint unique,
  add column if not exists telegram_username text;

create table if not exists public.telegram_chats (
  id uuid primary key default uuid_generate_v4(),
  chat_id bigint not null unique,
  label text not null,
  notification_types text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_action_tokens (
  id uuid primary key default uuid_generate_v4(),
  token_hash text not null unique,
  action text not null,
  entity_type text not null check (entity_type in ('order', 'followup')),
  entity_id uuid not null,
  target_stage text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_admin_id uuid references public.admins(id),
  created_at timestamptz not null default now()
);

create index if not exists telegram_action_active_idx
  on public.telegram_action_tokens (token_hash, expires_at)
  where consumed_at is null;

create table if not exists public.telegram_notification_logs (
  id uuid primary key default uuid_generate_v4(),
  chat_id bigint not null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  telegram_message_id bigint,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.telegram_chats enable row level security;
alter table public.telegram_action_tokens enable row level security;
alter table public.telegram_notification_logs enable row level security;

revoke all on public.telegram_chats from anon, authenticated;
revoke all on public.telegram_action_tokens from anon, authenticated;
revoke all on public.telegram_notification_logs from anon, authenticated;

commit;
```

Before applying the migration:

1. Add `packed` only to the Kanban projection; the canonical order status remains
   `confirmed` until the domain model formally adds a separate packed status.
2. Add `move_customer_kanban_card` and `move_followup_kanban_card` with the same
   identity, capability, row lock, validation, and audit requirements.
3. Regenerate `lib/supabase/types.ts`.
4. Run Supabase security and performance advisors.

## 3. Smooth Kanban Architecture

### 3.1 Rendering Boundary

```text
app/(protected)/kanban/page.tsx                Server Component
  -> authenticate and resolve capabilities
  -> fetch initial board snapshot
  -> pass serializable snapshot to KanbanClient

app/(protected)/kanban/kanban-client.tsx       Client Component
  -> QueryClient hydration/initialData
  -> DndContext and sensors
  -> columns and sortable cards

app/(protected)/kanban/actions.ts              Server Actions
  -> Zod validation
  -> requireCapability()
  -> transactional Supabase RPC
  -> revalidatePath("/kanban")
```

### 3.2 Library Choice

Use:

```text
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
```

Reasons:

- `DragOverlay` allows the active node to move independently of the list layout.
- Pointer, touch, and keyboard sensors can be tuned separately.
- `transform` data can be converted to `translate3d()` without React state updates
  on every pointer frame.
- Collision detection and drop-zone behavior are customizable.

### 3.3 60 FPS Dragging Rules

- Never update TanStack Query or React state from `onDragMove`.
- Keep live pointer position inside dnd-kit's internal refs.
- Render one lightweight `DragOverlay`; keep the original card as a placeholder.
- Use `CSS.Transform.toString(transform)` or an explicit
  `translate3d(x, y, 0)` style.
- Apply `will-change: transform` only to the active card and nearby drop zones.
- Avoid animated shadows, blur filters, or layout properties during pointer
  movement.
- Animate column reflow only after card index/stage changes.
- Use stable card IDs and memoized card components.
- Activate touch dragging after a small delay to preserve vertical scrolling.

Recommended sensors:

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 6 },
  }),
  useSensor(TouchSensor, {
    activationConstraint: { delay: 140, tolerance: 8 },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);
```

### 3.4 n8n-Inspired Visual Language

The board remains a business workflow, but cards behave like connected nodes:

- Columns are workflow lanes connected by a subtle horizontal gradient rail.
- Each card has left and right connector indicators.
- The connector toward a valid target illuminates during drag.
- Valid columns scale to `1.01`; invalid columns fade slightly.
- The active overlay scales to `1.025`, lifts above the board, and gains a
  rose-gold glow.
- The source placeholder remains visible to prevent layout collapse.
- Drop animation uses a short cubic-bezier spring approximation.

Representative Tailwind 4 classes:

```text
Card idle:
  transform-gpu transition-[transform,box-shadow,opacity]
  duration-300 ease-out

Card active:
  scale-[1.025] cursor-grabbing z-50
  shadow-[0_18px_50px_rgba(197,107,122,0.24)]
  ring-1 ring-primary/35

Column valid:
  scale-[1.01] bg-primary/[0.045]
  ring-1 ring-primary/20
  transition-all duration-300 ease-out

Column invalid:
  opacity-60 saturate-[0.85]

Connector:
  size-2 rounded-full bg-border
  transition-[transform,background-color,box-shadow]
  duration-200 ease-out

Connector active:
  scale-150 bg-primary
  shadow-[0_0_14px_rgba(197,107,122,0.65)]
```

Use inline style only for frame-critical transforms:

```tsx
style={{
  transform: transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
    : undefined,
  transition,
}}
```

Respect reduced motion:

```text
motion-reduce:transition-none
motion-reduce:transform-none
```

### 3.5 Positioning

Use sparse integer ranks:

```text
1000, 2000, 3000, ...
```

For a drop between cards:

```text
new rank = floor((previous rank + next rank) / 2)
```

If no integer remains between two ranks, enqueue/re-run a column rebalance RPC
that locks the column records and rewrites ranks in increments of 1000. Do not
rewrite every card during a normal move.

## 4. Optimistic State Strategy

TanStack Query owns the board snapshot:

```text
query key:
  ["kanban", entityType, filters]
```

The server component supplies `initialData`. The client uses the same query key,
so hydration does not trigger a blank loading state.

### 4.1 Drag Lifecycle

`onDragStart`

- Store only `activeId`, source stage, and measured card width in local refs.
- Do not mutate the query cache.
- Render the active card through `DragOverlay`.

`onDragOver`

- When the destination stage/index changes, compute the proposed sparse rank.
- Update a small local preview state for column highlighting.
- Optionally move a visual placeholder, but do not issue a request.

`onDragEnd`

1. Validate the transition against the client transition map.
2. Call a TanStack Query mutation.
3. In `onMutate`, cancel the board query and snapshot the current cache.
4. Immediately move the record to the target column and rank in the cache.
5. Start the drop animation from overlay position to the optimistic slot.
6. Call the Server Action.
7. On success, replace the optimistic record with the canonical RPC result.
8. On error, restore the snapshot and show a compact error toast.
9. In `onSettled`, invalidate the board query; the Server Action also calls
   `revalidatePath("/kanban")` for future server navigations.

Pseudocode:

```tsx
const moveCard = useMutation({
  mutationFn: moveKanbanCardAction,
  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData<KanbanSnapshot>(queryKey);

    queryClient.setQueryData<KanbanSnapshot>(
      queryKey,
      (current) => optimisticMove(current, input)
    );

    return { previous };
  },
  onError: (_error, _input, context) => {
    queryClient.setQueryData(queryKey, context?.previous);
  },
  onSuccess: (canonicalCard) => {
    queryClient.setQueryData<KanbanSnapshot>(
      queryKey,
      (current) => replaceCanonicalCard(current, canonicalCard)
    );
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey });
  },
});
```

### 4.2 Concurrency and Reconciliation

- Include the row's `updated_at` in every move request.
- The RPC rejects the move when persisted `updated_at` differs from the expected
  version.
- On conflict, restore the previous cache, refetch, and show
  "รายการนี้ถูกแก้ไขโดยผู้ใช้อื่นแล้ว".
- Prevent a second mutation for the same card while its first move is pending.
- Allow moves for different cards concurrently.

Zustand is optional only for ephemeral UI preferences such as collapsed columns,
zoom level, and selected board. It must not become a second source of truth for
cards.

## 5. API and Telegram Route Maps

### 5.1 Platform Webhooks

Exact route:

```text
app/api/webhooks/[platform]/route.ts
```

Supporting files:

```text
lib/platforms/types.ts
lib/platforms/registry.ts
lib/platforms/adapters/tiktok.ts
lib/platforms/adapters/shopee.ts
lib/platforms/adapters/facebook.ts
lib/platforms/verification/tiktok.ts
lib/platforms/verification/shopee.ts
lib/platforms/verification/facebook.ts
lib/platforms/webhook-inbox.ts
lib/jobs/handlers/webhook-dispatch.ts
```

Route behavior:

1. Read raw body with `await request.text()` or `arrayBuffer()` before parsing.
2. Resolve the platform verifier from a strict allow-list.
3. Verify timestamp, signature, account, and replay window.
4. Parse only after verification.
5. Insert the event into `platform_webhook_events` using the unique external ID.
6. Enqueue `webhook-dispatch` with the inbox row ID.
7. Return `200` for accepted or duplicate events.
8. Return `401` for invalid signatures and `400` for unsupported payloads.

The worker:

```text
webhook-dispatch
  -> load inbox row
  -> set processing
  -> adapter.normalizeEvent()
  -> transactional domain RPC
  -> update external mapping
  -> set processed
```

### 5.2 Telegram Webhook

Exact route:

```text
app/api/telegram/webhook/route.ts
```

Supporting files:

```text
lib/notifications/telegram.ts
lib/telegram/verify-webhook.ts
lib/telegram/actions.ts
lib/telegram/action-tokens.ts
lib/jobs/handlers/telegram-notification.ts
```

Environment variables:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_DEFAULT_CHAT_ID
PLATFORM_CREDENTIALS_ENCRYPTION_KEY
```

Route behavior:

1. Verify `X-Telegram-Bot-Api-Secret-Token` with a timing-safe comparison.
2. Accept only supported update types.
3. For callback queries, find `admins.telegram_user_id`.
4. Hash callback token and atomically consume the unexpired action row.
5. Call the same domain RPC used by the web Kanban with source `telegram`.
6. Call Telegram `answerCallbackQuery` immediately.
7. Enqueue message editing/notification work rather than blocking the webhook.

Never place raw entity IDs, role claims, or arbitrary SQL-like action names in
Telegram callback data.

## 6. Directory Blueprint

```text
app/
  (protected)/
    dashboard/
      page.tsx
      dashboards/
        owner-dashboard.tsx
        sales-dashboard.tsx
        crm-dashboard.tsx
        inventory-dashboard.tsx
    kanban/
      page.tsx
      actions.ts
      kanban-client.tsx
      components/
        kanban-board.tsx
        kanban-column.tsx
        kanban-card.tsx
        kanban-overlay.tsx
        workflow-connector.tsx
  api/
    webhooks/
      [platform]/
        route.ts
    telegram/
      webhook/
        route.ts

lib/
  auth/
    capabilities.ts
    shield.ts
  data/
    dashboard.ts
    kanban.ts
  kanban/
    types.ts
    transitions.ts
    optimistic-move.ts
    ranking.ts
  platforms/
    types.ts
    registry.ts
    webhook-inbox.ts
    adapters/
      tiktok.ts
      shopee.ts
      facebook.ts
    verification/
      tiktok.ts
      shopee.ts
      facebook.ts
  telegram/
    actions.ts
    action-tokens.ts
    verify-webhook.ts
  notifications/
    telegram.ts
  jobs/
    handlers/
      webhook-dispatch.ts
      telegram-notification.ts

supabase/
  migrations/
    <timestamp>_rbac_kanban_integrations.sql
```

## 7. Implementation Roadmap

### Milestone 1: RBAC Contract

- Apply role migration and capability table.
- Update `lib/auth/shield.ts` to use database-backed capabilities.
- Add role-aware sidebar and dashboard selection.
- Restrict financial metrics to owner/admin.
- Add role and RLS tests.

Exit criteria:

- Every role sees only its dashboard.
- Direct RPC/API attempts outside capability fail.

### Milestone 2: Orders Kanban Vertical Slice

- Add order Kanban columns, ranks, transition log, and move RPC.
- Add `@dnd-kit` dependencies.
- Implement server page, action, query, board, columns, cards, and overlay.
- Implement optimistic move, conflict rollback, keyboard dragging, and reduced
  motion.

Exit criteria:

- Smooth desktop and mobile dragging without state updates per pointer frame.
- Invalid transitions cannot be persisted.
- Network failure restores the original card position.

### Milestone 3: Customers and Follow-ups

- Add domain RPCs and transition maps.
- Reuse the board primitives with entity-specific cards.
- Add platform projection filters rather than duplicate platform state.

Exit criteria:

- All three boards share interaction primitives but retain domain validation.

### Milestone 4: Webhook Inbox

- Add integration tables and server-only permissions.
- Implement unified route, verifiers, adapter interface, and inbox enqueue.
- Complete TikTok first, then Shopee, then Facebook.
- Add duplicate, replay, retry, and malformed-payload tests.

Exit criteria:

- Webhook response remains fast.
- Duplicate events do not duplicate orders or inventory mutations.

### Milestone 5: Telegram

- Add administrator mapping and chat configuration.
- Add outbound notification jobs.
- Add verified webhook and single-use callbacks.
- Route Telegram actions through the Kanban RPCs.

Exit criteria:

- Unauthorized Telegram users cannot mutate data.
- Replayed and expired callback tokens fail safely.

### Milestone 6: Production Hardening

- Add indexes based on real query plans.
- Run Supabase security/performance advisors.
- Add queue lag, webhook failure, and Telegram delivery metrics.
- Add dead-letter/replay administration.
- Test Docker app and worker services together.
- Roll out each integration behind a per-account feature flag.
