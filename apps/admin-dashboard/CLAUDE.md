# CLAUDE.md — @docs.plus/admin-dashboard

The client half of the admin data path. The server half — the REST routes, their Zod schemas, and the service that backs them — lives in [apps/hocuspocus.server/CLAUDE.md](../hocuspocus.server/CLAUDE.md) §Admin API And Dashboard. Read [AGENTS.md](../../AGENTS.md) for the repo-wide rules.

## Admin data path

- **Never read an admin table with the browser anon key.** Every admin-only data path goes through an `is_admin()`-gated `SECURITY DEFINER` RPC or the `service_role` hocuspocus REST API. The rule, the revoked tables, and the 1000-row pagination cap are stated once, in [apps/hocuspocus.server/CLAUDE.md](../hocuspocus.server/CLAUDE.md) §Admin API And Dashboard — this bullet exists because that file does not load here.
- This app reaches hocuspocus REST on `NEXT_PUBLIC_API_URL` (port 4000 locally). It does not call Supabase directly for admin reads.
- Audit pages reuse one shell: `StatCard` / `DataTable` / `useTableParams` (see `pages/documents/stale.tsx`). Do not grow a second table stack.
- **The Email setup page (`apps/admin-dashboard/src/pages/email.tsx`) is read-only for config.** It never shows a secret value or a tail of one, only `set` or `missing`. No credential is written from the UI; the host env file is the only source. It reads `GET /api/admin/email/setup` only, and its one action is **Send test email**. The Notifications gateway card reads the same route without a poll, because each read runs a live provider check.
- **Digest mail settings live on Notifications.** The card sets one mail per document or one combined mail, and the HTML size limit in KB. The routes are `GET` and `PUT /api/admin/email/digest-grouping`. The defaults and the Redis keys live in [apps/hocuspocus.server/CLAUDE.md](../hocuspocus.server/CLAUDE.md) §Digest Email Links And Counts.
