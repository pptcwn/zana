# ZANA Security and Integrity Refactor Implementation Plan

**Design:** `docs/superpowers/specs/2026-06-07-security-integrity-refactor-design.md`

## Phase 1: Database contract

- Add `admins.auth_user_id` and migrate links from `auth.users`.
- Add private RBAC helpers and replace broad/deprecated RLS policies.
- Add a concurrency-safe daily order counter.
- Add the atomic `create_order_transaction` RPC.
- Remove overlapping item/stock/total triggers.
- Make delivery-transition triggers the sole automatic follow-up owner.
- Add uniqueness and status constraints.
- Update `zana_supabase_schema.sql` and `lib/supabase/types.ts`.

Verification:

- SQL migration passes static review and function privilege checks.
- TypeScript recognizes the new column, table, and RPC.

## Phase 2: Server Action boundary

- Add `lib/auth/shield.ts` with the approved role/capability matrix.
- Validate inputs with Zod at each mutation boundary.
- Require a capability in every protected Server Action.
- Forward the authenticated administrator ID to audited mutations.

Verification:

- Search confirms every exported mutation calls `requireCapability`.
- Typecheck rejects unknown roles and capabilities.

## Phase 3: Atomic orders and follow-ups

- Replace multi-request order creation with the authenticated RPC.
- Submit only product IDs and quantities from the browser.
- Normalize persisted statuses to `pending`, `confirmed`, `shipped`,
  `delivered`, and `cancelled`.
- Remove application follow-up insertion.

Verification:

- Order creation has one database call.
- No application code inserts automatic follow-ups.
- UI actions use canonical statuses.

## Phase 4: Pagination and filtering

- Add shared page parameter/result helpers.
- Add paginated queries for orders, customers, and products.
- Read filters from Next.js 16 async `searchParams`.
- Move search/filter state into the URL and add pagination controls.
- Keep product choices for order creation separate from the paginated list.

Verification:

- No full-list client filtering remains on the three pages.
- `.range()` and exact count are used by all paginated queries.
- URL query changes preserve styling and workflow.

## Phase 5: Background worker

- Replace the placeholder JavaScript worker with typed queue modules.
- Register `platform-sync` and `followup-reminder`.
- Add graceful shutdown and structured logging.
- Compile the worker separately and package it in the Docker runner.

Verification:

- Worker TypeScript build succeeds.
- Docker commands target emitted JavaScript.
- Missing environment configuration fails fast.

## Phase 6: Final verification and documentation

- Run lint, TypeScript, Next.js build, and worker build.
- Run static security and ownership searches.
- Update the architecture document to the implemented state.
- Record database-dependent verification that requires applying the migration.
