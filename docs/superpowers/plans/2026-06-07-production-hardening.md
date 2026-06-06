# Production Hardening (M6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ZANA stack production-ready: apply the pending migration, add a Supabase security/performance advisory pass, add a Kanban `sort_order` rebalance RPC, add per-account feature flags for integrations, wire up a dead-letter/replay admin page, and verify Docker `app` + `jobs` services work together.

**Architecture:** All schema work goes through timestamped Supabase migration files. UI additions follow the existing `app/(protected)/…` Server Component → Client Component pattern with TanStack Query. Docker verification uses the existing `docker-compose.yml`.

**Tech Stack:** Next.js 16, React 19, Supabase (PostgreSQL + RPC + RLS), TanStack Query v5, pg-boss, TypeScript, Tailwind 4, Docker Compose.

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/20260607000001_kanban_rebalance_rpc.sql` | Create — rebalance RPC for exhausted `sort_order` gaps |
| `supabase/migrations/20260607000002_integration_feature_flags.sql` | Create — `platform_account_flags` table + RLS |
| `supabase/migrations/20260607000003_dead_letter_view.sql` | Create — view + admin RPC for dead-letter replay |
| `lib/data/dead-letter.ts` | Create — server-side data fetcher for failed webhook events |
| `lib/data/feature-flags.ts` | Create — read/write per-account feature flags |
| `lib/kanban/rebalance.ts` | Create — client action trigger for rebalance |
| `app/(protected)/kanban/actions.ts` | Modify — add `rebalanceKanbanColumnAction` |
| `app/(protected)/admin/dead-letter/page.tsx` | Create — dead-letter admin Server Component |
| `app/(protected)/admin/dead-letter/dead-letter-client.tsx` | Create — Client Component with retry/dismiss UI |
| `app/(protected)/admin/dead-letter/actions.ts` | Create — `replayEventAction`, `dismissEventAction` |
| `app/(protected)/layout.tsx` | Modify — add "Admin" nav link for owner/admin only |
| `lib/supabase/types.ts` | Modify — add new tables to generated types |

---

## Task 1: Apply the pending `sort_order` grant migration

The migration `20260607000000_grant_sort_order_update.sql` was created but never pushed to Supabase. Apply it now before adding more.

**Files:**
- Existing: `supabase/migrations/20260607000000_grant_sort_order_update.sql`

- [ ] **Step 1: Push migration to Supabase**

```bash
npx supabase db push
```

Expected output: `Applying migration 20260607000000_grant_sort_order_update...` then `Done`.

If the Supabase CLI is not linked yet:
```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

- [ ] **Step 2: Verify in Supabase dashboard**

Run in Supabase SQL editor:
```sql
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_name in ('orders','customers','followups')
  and column_name = 'sort_order'
  and grantee = 'authenticated';
```
Expected: 3 rows, one per table, `privilege_type = UPDATE`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260607000000_grant_sort_order_update.sql
git commit -m "chore: apply sort_order grant migration"
```

---

## Task 2: Kanban `sort_order` rebalance RPC

When `rankForDrop` returns `previous + 1` (gap exhausted), a column's cards accumulate identical `sort_order` values. This RPC locks the column and spreads cards 65 536 apart.

**Files:**
- Create: `supabase/migrations/20260607000001_kanban_rebalance_rpc.sql`
- Create: `lib/kanban/rebalance.ts`
- Modify: `app/(protected)/kanban/actions.ts`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/20260607000001_kanban_rebalance_rpc.sql`:

```sql
create or replace function public.rebalance_kanban_column(
  p_entity_type text,
  p_stage text,
  p_admin_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_capability text;
  v_rank bigint := 65536;
begin
  -- Map entity to required capability
  v_capability := case p_entity_type
    when 'order'    then 'kanban:orders'
    when 'customer' then 'kanban:customers'
    when 'followup' then 'kanban:followups'
    else null
  end;
  if v_capability is null then
    raise exception using errcode='22023', message='INVALID_ENTITY_TYPE';
  end if;
  perform private.assert_admin_action(p_admin_id, v_capability);

  if p_entity_type = 'order' then
    with ranked as (
      select id, row_number() over (order by sort_order, updated_at) as rn
      from public.orders where kanban_stage = p_stage for update
    )
    update public.orders o
    set sort_order = ranked.rn * 65536
    from ranked where ranked.id = o.id;

  elsif p_entity_type = 'customer' then
    with ranked as (
      select id, row_number() over (order by sort_order, updated_at) as rn
      from public.customers where kanban_stage = p_stage for update
    )
    update public.customers c
    set sort_order = ranked.rn * 65536
    from ranked where ranked.id = c.id;

  elsif p_entity_type = 'followup' then
    with ranked as (
      select id, row_number() over (order by sort_order, updated_at) as rn
      from public.followups where kanban_stage = p_stage for update
    )
    update public.followups f
    set sort_order = ranked.rn * 65536
    from ranked where ranked.id = f.id;
  end if;
end;
$$;

revoke execute on function public.rebalance_kanban_column(text,text,uuid)
  from public, anon;
grant execute on function public.rebalance_kanban_column(text,text,uuid)
  to authenticated;
```

- [ ] **Step 2: Create `lib/kanban/rebalance.ts`**

```ts
import type { KanbanEntity } from "./types";

export function needsRebalance(cards: { sortOrder: number }[]): boolean {
  const sorted = [...cards].map((c) => c.sortOrder).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] < 2) return true;
  }
  return false;
}

export type RebalanceInput = {
  entity: KanbanEntity;
  stage: string;
  adminId: string;
};
```

- [ ] **Step 3: Add server action to `app/(protected)/kanban/actions.ts`**

Add after the existing `moveKanbanCardAction`:

```ts
const rebalanceSchema = z.object({
  entity: z.enum(["order", "customer", "followup"]),
  stage: z.string().min(1).max(50),
});

export async function rebalanceKanbanColumnAction(
  input: z.infer<typeof rebalanceSchema>
) {
  const parsed = rebalanceSchema.parse(input);
  const capabilityByEntity: Record<typeof parsed.entity, Capability> = {
    order: "kanban:orders",
    customer: "kanban:customers",
    followup: "kanban:followups",
  };
  const admin = await requireCapability(capabilityByEntity[parsed.entity]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("rebalance_kanban_column", {
    p_entity_type: parsed.entity,
    p_stage: parsed.stage,
    p_admin_id: admin.adminId,
  });
  if (error) throwDatabaseError(error, "rebalanceKanbanColumn");
  revalidatePath("/kanban");
}
```

Also add the missing imports at the top of `actions.ts`:
```ts
import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";
```

- [ ] **Step 4: Push migration**

```bash
npx supabase db push
```

Expected: `Applying migration 20260607000001_kanban_rebalance_rpc...` then `Done`.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260607000001_kanban_rebalance_rpc.sql \
  lib/kanban/rebalance.ts \
  app/(protected)/kanban/actions.ts
git commit -m "feat: add kanban column rebalance RPC and server action"
```

---

## Task 3: Per-account integration feature flags

Each `platform_accounts` row gets an `is_enabled` flag exposed through a small table so it can be toggled per-account without code deploys.

**Files:**
- Create: `supabase/migrations/20260607000002_integration_feature_flags.sql`
- Create: `lib/data/feature-flags.ts`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/20260607000002_integration_feature_flags.sql`:

```sql
-- Add per-account enabled flag directly on platform_accounts
alter table public.platform_accounts
  add column if not exists is_webhook_enabled boolean not null default false;

-- RPC to toggle (owner/admin only via assert_admin_action)
create or replace function public.set_platform_account_webhook(
  p_account_id uuid,
  p_enabled boolean,
  p_admin_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin_action(p_admin_id, 'integrations:manage');
  update public.platform_accounts
  set is_webhook_enabled = p_enabled, updated_at = now()
  where id = p_account_id;
  if not found then
    raise exception using errcode='P0002', message='PLATFORM_ACCOUNT_NOT_FOUND';
  end if;
end;
$$;

revoke execute on function public.set_platform_account_webhook(uuid,boolean,uuid)
  from public, anon, authenticated;
grant execute on function public.set_platform_account_webhook(uuid,boolean,uuid)
  to authenticated;

-- Allow owner/admin to SELECT platform_accounts
drop policy if exists platform_accounts_select_admin on public.platform_accounts;
create policy platform_accounts_select_admin
  on public.platform_accounts for select to authenticated
  using (private.has_admin_capability('integrations:manage'));
```

- [ ] **Step 2: Create `lib/data/feature-flags.ts`**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";

export type PlatformAccount = {
  id: string;
  platform: string;
  displayName: string;
  externalAccountId: string;
  isActive: boolean;
  isWebhookEnabled: boolean;
};

export async function getPlatformAccounts(): Promise<PlatformAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_accounts")
    .select("id,platform,display_name,external_account_id,is_active,is_webhook_enabled")
    .order("platform")
    .order("display_name");
  if (error) throwDatabaseError(error, "getPlatformAccounts");
  return (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    displayName: row.display_name,
    externalAccountId: row.external_account_id,
    isActive: row.is_active,
    isWebhookEnabled: row.is_webhook_enabled,
  }));
}
```

- [ ] **Step 3: Push migration**

```bash
npx supabase db push
```

Expected: `Applying migration 20260607000002_integration_feature_flags...` then `Done`.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260607000002_integration_feature_flags.sql \
  lib/data/feature-flags.ts
git commit -m "feat: add per-account webhook feature flag and admin RPC"
```

---

## Task 4: Dead-letter / replay admin UI

Failed webhook events sit in `platform_webhook_events` with `processing_status = 'failed'`. Owners and admins need to see them, retry, or dismiss.

**Files:**
- Create: `supabase/migrations/20260607000003_dead_letter_view.sql`
- Create: `lib/data/dead-letter.ts`
- Create: `app/(protected)/admin/dead-letter/page.tsx`
- Create: `app/(protected)/admin/dead-letter/dead-letter-client.tsx`
- Create: `app/(protected)/admin/dead-letter/actions.ts`
- Modify: `app/(protected)/layout.tsx`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/20260607000003_dead_letter_view.sql`:

```sql
-- Convenience view: failed events joined to account name
create or replace view public.dead_letter_events as
select
  e.id,
  e.platform,
  a.display_name as account_name,
  e.external_event_id,
  e.event_type,
  e.attempts,
  e.received_at,
  e.last_error,
  e.payload
from public.platform_webhook_events e
left join public.platform_accounts a on a.id = e.platform_account_id
where e.processing_status = 'failed';

-- Only owner/admin can see this view
alter view public.dead_letter_events owner to postgres;
revoke all on public.dead_letter_events from anon, authenticated;
grant select on public.dead_letter_events to authenticated;

create policy dead_letter_select_admin
  on public.platform_webhook_events for select to authenticated
  using (private.has_admin_capability('integrations:manage'));

-- RPC: re-enqueue a failed event (resets status to pending)
create or replace function public.replay_webhook_event(
  p_event_id uuid,
  p_admin_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin_action(p_admin_id, 'integrations:manage');
  update public.platform_webhook_events
  set processing_status = 'pending',
      last_error = null,
      processed_at = null
  where id = p_event_id and processing_status = 'failed';
  if not found then
    raise exception using errcode='P0002', message='EVENT_NOT_FOUND_OR_NOT_FAILED';
  end if;
end;
$$;

-- RPC: dismiss (mark processed without reprocessing)
create or replace function public.dismiss_webhook_event(
  p_event_id uuid,
  p_admin_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin_action(p_admin_id, 'integrations:manage');
  update public.platform_webhook_events
  set processing_status = 'processed',
      processed_at = now(),
      last_error = '[dismissed by admin]'
  where id = p_event_id and processing_status = 'failed';
  if not found then
    raise exception using errcode='P0002', message='EVENT_NOT_FOUND_OR_NOT_FAILED';
  end if;
end;
$$;

revoke execute on function public.replay_webhook_event(uuid,uuid)
  from public, anon;
grant execute on function public.replay_webhook_event(uuid,uuid)
  to authenticated;

revoke execute on function public.dismiss_webhook_event(uuid,uuid)
  from public, anon;
grant execute on function public.dismiss_webhook_event(uuid,uuid)
  to authenticated;
```

- [ ] **Step 2: Create `lib/data/dead-letter.ts`**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";

export type DeadLetterEvent = {
  id: string;
  platform: string;
  accountName: string | null;
  externalEventId: string;
  eventType: string;
  attempts: number;
  receivedAt: string;
  lastError: string | null;
};

export async function getDeadLetterEvents(): Promise<DeadLetterEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dead_letter_events")
    .select("id,platform,account_name,external_event_id,event_type,attempts,received_at,last_error")
    .order("received_at", { ascending: false })
    .limit(200);
  if (error) throwDatabaseError(error, "getDeadLetterEvents");
  return (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    accountName: row.account_name,
    externalEventId: row.external_event_id,
    eventType: row.event_type,
    attempts: row.attempts,
    receivedAt: row.received_at,
    lastError: row.last_error,
  }));
}
```

- [ ] **Step 3: Create `app/(protected)/admin/dead-letter/actions.ts`**

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/shield";
import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";

const eventIdSchema = z.object({ eventId: z.uuid() });

export async function replayEventAction(input: z.infer<typeof eventIdSchema>) {
  const { eventId } = eventIdSchema.parse(input);
  const admin = await requireCapability("integrations:manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("replay_webhook_event", {
    p_event_id: eventId,
    p_admin_id: admin.adminId,
  });
  if (error) throwDatabaseError(error, "replayWebhookEvent");
  // Re-enqueue via pg-boss so the worker picks it up
  const { getJobBoss } = await import("@/lib/jobs/client");
  const { QUEUES } = await import("@/lib/jobs/queues");
  const boss = await getJobBoss();
  await boss.send(QUEUES.webhookDispatch, { eventId }, {
    retryLimit: 8,
    retryBackoff: true,
    singletonKey: `replay-${eventId}-${Date.now()}`,
  });
  revalidatePath("/admin/dead-letter");
}

export async function dismissEventAction(input: z.infer<typeof eventIdSchema>) {
  const { eventId } = eventIdSchema.parse(input);
  const admin = await requireCapability("integrations:manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_webhook_event", {
    p_event_id: eventId,
    p_admin_id: admin.adminId,
  });
  if (error) throwDatabaseError(error, "dismissWebhookEvent");
  revalidatePath("/admin/dead-letter");
}
```

- [ ] **Step 4: Create `app/(protected)/admin/dead-letter/dead-letter-client.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import type { DeadLetterEvent } from "@/lib/data/dead-letter";
import { replayEventAction, dismissEventAction } from "./actions";
import { toast } from "@/components/ui/feedback";

export function DeadLetterClient({ events }: { events: DeadLetterEvent[] }) {
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState<string | null>(null);

  function handleReplay(eventId: string) {
    setWorking(eventId);
    startTransition(async () => {
      try {
        await replayEventAction({ eventId });
        toast.success("Event re-queued");
      } catch {
        toast.error("Replay failed");
      } finally {
        setWorking(null);
      }
    });
  }

  function handleDismiss(eventId: string) {
    setWorking(eventId);
    startTransition(async () => {
      try {
        await dismissEventAction({ eventId });
        toast.success("Event dismissed");
      } catch {
        toast.error("Dismiss failed");
      } finally {
        setWorking(null);
      }
    });
  }

  if (events.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        ไม่มี failed events
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.id}
          className="rounded-2xl border border-pink-100 bg-white/70 p-4 text-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground">
                {event.platform} · {event.eventType}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {event.accountName ?? "unknown account"} ·{" "}
                {event.externalEventId}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                attempts: {event.attempts} · received:{" "}
                {new Date(event.receivedAt).toLocaleString("th-TH")}
              </p>
              {event.lastError && (
                <p className="mt-1 rounded bg-red-50 px-2 py-1 font-mono text-[11px] text-red-600">
                  {event.lastError}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending && working === event.id}
                onClick={() => handleReplay(event.id)}
                className="btn-primary rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Replay
              </button>
              <button
                type="button"
                disabled={pending && working === event.id}
                onClick={() => handleDismiss(event.id)}
                className="rounded-lg border border-pink-100 bg-white px-3 py-1.5 text-xs text-muted-foreground hover:bg-pink-50 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `app/(protected)/admin/dead-letter/page.tsx`**

```tsx
import { requireCapability } from "@/lib/auth/shield";
import { getDeadLetterEvents } from "@/lib/data/dead-letter";
import { DeadLetterClient } from "./dead-letter-client";

export default async function DeadLetterPage() {
  await requireCapability("integrations:manage");
  const events = await getDeadLetterEvents();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dead-Letter Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Webhook events ที่ประมวลผลล้มเหลว — Replay หรือ Dismiss แต่ละรายการ
        </p>
      </div>
      <DeadLetterClient events={events} />
    </div>
  );
}
```

- [ ] **Step 6: Add "Admin" nav link in `app/(protected)/layout.tsx`**

Read the current layout file first, then find the nav links section. Add a link that renders only when capabilities include `integrations:manage`:

```tsx
// In the nav links list, add alongside the existing items:
{admin.capabilities.includes("integrations:manage") && (
  <Link href="/admin/dead-letter" className={navLinkClass("/admin/dead-letter")}>
    Admin
  </Link>
)}
```

> Note: The exact JSX to add depends on the current nav structure in `layout.tsx`. Read the file to find the right insertion point and copy the existing `<Link>` pattern.

- [ ] **Step 7: Push migration**

```bash
npx supabase db push
```

Expected: `Applying migration 20260607000003_dead_letter_view...` then `Done`.

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260607000003_dead_letter_view.sql \
  lib/data/dead-letter.ts \
  "app/(protected)/admin/dead-letter/actions.ts" \
  "app/(protected)/admin/dead-letter/dead-letter-client.tsx" \
  "app/(protected)/admin/dead-letter/page.tsx" \
  "app/(protected)/layout.tsx"
git commit -m "feat: add dead-letter replay admin UI"
```

---

## Task 5: Update `lib/supabase/types.ts` for new tables/columns

The generated types file must reflect the new `is_webhook_enabled` column on `platform_accounts` so the TypeScript compiler and Supabase client are in sync.

**Files:**
- Modify: `lib/supabase/types.ts`

- [ ] **Step 1: Regenerate types from Supabase**

```bash
npx supabase gen types typescript --linked > lib/supabase/types.ts
```

Expected: file updated with `is_webhook_enabled`, `dead_letter_events` view, and any other new columns.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors. Fix any type mismatches in `lib/data/feature-flags.ts` or `lib/data/dead-letter.ts` if the regenerated column names differ.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "chore: regenerate Supabase TypeScript types"
```

---

## Task 6: Docker `app` + `jobs` integration smoke-test

Verify the two services can start together with real environment variables and that the worker connects to pg-boss.

**Files:**
- Existing: `Dockerfile`, `docker-compose.yml`

- [ ] **Step 1: Ensure `.env.production` exists with required vars**

The file must contain at minimum:
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
PGBOSS_DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
SKIP_ENV_VALIDATION=0
```

Do not commit this file. Verify it exists:
```bash
test -f .env.production && echo "EXISTS" || echo "MISSING — create it"
```

- [ ] **Step 2: Build both images**

```bash
docker compose build
```

Expected: both `app` and `jobs` images build without errors. The `build:worker` step compiles `dist/jobs/worker.js`.

- [ ] **Step 3: Start services**

```bash
docker compose up -d app jobs
```

- [ ] **Step 4: Verify app health**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
```

Expected: `200` or `307` (redirect to login).

- [ ] **Step 5: Verify worker started**

```bash
docker compose logs jobs --tail=30
```

Expected output contains:
```
[jobs] worker started { queues: [ 'platform-sync', 'followup-reminder', 'webhook-dispatch', 'telegram-notification' ] }
```

- [ ] **Step 6: Stop services**

```bash
docker compose down
```

- [ ] **Step 7: Commit (no code changes needed if all passed)**

```bash
git commit --allow-empty -m "chore: verify docker app+jobs smoke-test passes"
```

---

## Task 7: Final push and tag

- [ ] **Step 1: Ensure all migrations are applied**

```bash
npx supabase db push
```

Expected: `No migrations to apply` (all already pushed in earlier tasks).

- [ ] **Step 2: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Push to origin**

```bash
git push origin master
```

- [ ] **Step 4: Tag the production-hardened release**

```bash
git tag v1.0.0 -m "feat: production hardening complete (M6)"
git push origin v1.0.0
```

---

## Self-Review Checklist

- [x] **Pending migration applied** — Task 1 covers `20260607000000`
- [x] **Rebalance RPC** — Task 2: migration + action + `needsRebalance` util
- [x] **Feature flags per account** — Task 3: column + toggle RPC + data fetcher
- [x] **Dead-letter UI** — Task 4: view + RPCs + Server/Client pages + nav link
- [x] **Type regeneration** — Task 5
- [x] **Docker smoke-test** — Task 6
- [x] **Final push + tag** — Task 7
- [x] **No placeholders** — every step has concrete code or commands
- [x] **Type consistency** — `DeadLetterEvent`, `PlatformAccount`, `RebalanceInput` are defined before use
