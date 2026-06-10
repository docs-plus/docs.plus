# Admin Dashboard — Audit & Remediation

**Verdict:** the dashboard was well-built structurally (clean webapp isolation, no XSS sinks, no leaked secrets, a real `admin_users` authorization check) but **not production-ready** — one irreversible data-loss bug and a systemic data-reliability flaw where every system-wide stat was computed through the browser's RLS-scoped anon-key client. This branch fixes both, across three layers (frontend, hocuspocus backend, Supabase SQL).

Work was done in an isolated worktree (`worktree-admin-dashboard-audit`) at your request. Nothing is committed; review the diff and run the developer steps below before deploying.

## Root cause

The dashboard had two data paths. The `services/api.ts` path (documents, views, retention, ghost accounts) already went through the hocuspocus REST API using `service_role` behind a real admin-checking middleware — correct. The `services/supabase.ts` **direct anon-key path** ran as role `authenticated` under RLS, so:

- `users.email` is column-revoked from `authenticated` → `fetchUsers` threw `42501` on every render (**P0, Users page down**).
- `push_subscriptions` / `email_queue` are table-revoked → push/email stats silently rendered `0`.
- `notifications` / `messages` / `channels` counts were scoped to the admin's own rows → wrong headline numbers.
- `channels` list used `workspaces!inner` under member-only RLS → near-empty for a non-member admin.
- Client-side aggregations read unbounded selects capped at 1000 rows → wrong past that threshold.

The fix routes these through the existing admin-gated, RLS-bypassing service_role API.

## What changed

### Frontend (`apps/admin-dashboard`) — verified: typecheck + lint + production build all pass

- **Ghost Accounts data-loss (P1, irreversible):** "Select All" + Delete and CSV Export operated on the unfiltered ghost list while the table showed only non-anonymous rows — an admin could permanently delete anonymous accounts never shown. Scoped selection/delete/export to one memoized `visibleGhosts`.
- **Stats re-routing:** `fetchSupabaseStats`, `fetchNotificationStats`, `fetchPushStats`, `fetchEmailStats`, `fetchPushPipelineStats`, `fetchPushSubscriptionAnalytics`, `fetchPlatformTrend`, `fetchTableSizes`, `fetchUserNotificationSubscriptions`, `fetchUsers`, `fetchChannels` now call the service_role backend. Analytics/trend keep their (correct) client-side aggregation, now fed fleet-wide data; errors surface to React Query instead of rendering silent zeros.
- **Chart/label correctness:** `ViewsTrendChart` bound a non-existent `unique_sessions` field → switched to `unique_visitors` (what the RPC returns); DAU trend relabelled "Users by Last-Seen Day" (it buckets a single last-seen column, not daily activity); summary card relabelled "Engaged Readers" (sums per-document distinct users).
- **Stale-docs "Export Selected"** now exports the selection, not the whole page.
- **Auth listener** moved to its own mount-once effect so it survives client-side navigation (was torn down after the first route change); `navigateTo` dep fixed.
- **Perf:** removed the dead 3-table realtime subscription that resubscribed every render (those tables aren't in the publication); debounced the Users-page realtime refetch; made the System health probe a head-only request (no full count).
- **Security:** CSV formula-injection neutralization (`= + - @` prefixes); search sanitization (LIKE wildcards + PostgREST `.or()` delimiters) now enforced server-side.
- **Cleanup:** removed dead utils/types (`formatNumber`, `formatPercent`, `formatDateForExport`, `logWarn`, `logInfo`, `PushDebugStats`, `RecentPushAttempt`, duplicate `PushGatewayHealth`, dead `sanitize.ts`); deduped the push-detail mapper; routed services through the dev-safe logger; deleted ~50 banned section-banner comment lines; trimmed the oversized Avatar JSDoc; corrected the README (Pages Router, real structure, `dev:ci`, env vars) and the misleading `next.config` PPR comment.

### Backend (`apps/hocuspocus.server`) — verified: typecheck + lint pass

- New `admin-stats.controller.ts` + routes under `/api/admin/*` (all behind the existing `adminAuthMiddleware`): `stats/platform`, `stats/notifications`, `stats/email`, `stats/push`, `stats/push/pipeline`, `push/subscriptions`, `system/table-sizes`, `users`, `users/notification-subs`, `channels`. All aggregate via the `service_role` client (RLS-bypassing, system-wide), paginating past the 1000-row cap where it reads rows.

### Supabase SQL (`packages/supabase`) — static review only; NOT runtime-verified (no local DB here)

- `22-user-retention.sql`: added `deleted_at is null` to `get_retention_metrics`, `get_user_lifecycle_segments`, `get_notification_reach`; added `is_active = true` to notification reach's push count; changed `get_top_active_documents.workspace_id` `uuid → text` (matches `workspaces.id`).
- `11-indexes.sql`: added plain `idx_messages_created_at` (converts 5 analytics paths from seq-scans of the largest table to range scans).
- `09-document-views.sql`: **privilege-escalation fix** — revoked the four `get_document_views_*` analytics RPCs from `authenticated`, granted `service_role` only (no frontend calls them directly); `views_today` now derived at read time from `document_views_daily` (was a stale stored snapshot).
- Paired migration: `migrations/20260609092031_admin_stats_correctness.sql`.

## Developer steps before deploy

1. **Apply + verify SQL locally:** `bun run --filter @docs.plus/supabase_back reset` then `bun run --filter @docs.plus/supabase_back types` (regenerates `apps/webapp/src/types/supabase.ts` — **required**: `get_top_active_documents` changed its return shape). Commit the regenerated types.
2. **Deploy the hocuspocus backend** (new admin endpoints) and the admin-dashboard together — the frontend now depends on those endpoints.
3. **Smoke-test** each admin page against real data (no live DB was available here): dashboard counts, Users (loads + search + email column), Channels (not empty), push/email/notification panels (non-zero), Ghost "Select All" selects only visible rows.
4. **Confirm prod grants** match the scripts (`information_schema.role_table_grants` / `role_routine_grants`) — the scripts are canonical, but whether prod had already drifted from them could not be observed from here.

## Not done (deliberate — recommendations, not defects)

- **Dead deps** (`@supabase/ssr`, `dotenv`, `eslint-config-next`; `@types/node` → `catalog:`): left for a controlled `bun install` so the shared `bun.lock` diff stays scoped.
- **True DAU rebuild** from a per-day activity source, **global-distinct unique visitors** recompute: new data pipelines, not relabels — out of scope.
- **Consolidating the per-enum head-counts into SQL aggregate RPCs** (review item B1): fewer round-trips and a smaller controller — but it adds untested `SECURITY DEFINER` SQL (no `db reset` here) with subtle traps (rounding, the `deleted_at` asymmetry between channels and notifications). Adding unverifiable SQL risks the reliability the audit just secured, so it's deferred; the per-enum head-counts are plain, verified TS.
- `recharts` code-splitting, `SortDirection`/`DLQViewer`/className-merge consolidation: low-payoff, internal tool.
- No tests added (repo policy: opt-in). The highest-value one later would be a Cypress check that Ghost "Select All" selects only visible rows.

## Thermo-nuclear review (follow-up)

A strict structural review of this diff returned **clean-with-quick-wins** and confirmed the audit's own fixes are correct. Applied:

- **Deleted dead code** the rewrite carried forward: `fetchPlatformTrend` + `PlatformTrendPoint` had zero callers.
- **Fixed a latent bug it introduced:** `getPlatformStats` / `getNotificationStatsAdmin` didn't check `.error` on their count queries, so a failed count returned HTTP 200 with a silently-zeroed stat. They now throw (→ 500), matching the email/push handlers.
- **Documented** the `push_subscriptions` full-table-transfer scaling cliff at `getPushSubscriptionsRaw`.

Deliberate behavior change to ratify: **"Export Selected"** on the stale-documents page now exports the selection (it previously exported the whole page — the button was mislabeled).

## Standing invariant (for future work)

Any new admin-only data path must go through an `is_admin()`-gated SECURITY DEFINER RPC or the `service_role` hocuspocus API — **never a direct anon-key table read**. The browser client is RLS-scoped and several admin tables/columns are revoked from `authenticated`, so direct reads return wrong, zero, or error results.
