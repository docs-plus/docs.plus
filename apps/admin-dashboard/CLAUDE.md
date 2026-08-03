# CLAUDE.md — @docs.plus/admin-dashboard

The client half of the admin data path. The server half — the REST routes, their Zod schemas, and the service that backs them — lives in [apps/hocuspocus.server/CLAUDE.md](../hocuspocus.server/CLAUDE.md) §Admin API And Dashboard. Read [AGENTS.md](../../AGENTS.md) for the repo-wide rules.

## Admin data path

- **Never read an admin table with the browser anon key.** Every admin-only data path goes through an `is_admin()`-gated `SECURITY DEFINER` RPC or the `service_role` hocuspocus REST API. The rule, the revoked tables, and the 1000-row pagination cap are stated once, in [apps/hocuspocus.server/CLAUDE.md](../hocuspocus.server/CLAUDE.md) §Admin API And Dashboard — this bullet exists because that file does not load here.
- This app reaches hocuspocus REST on `NEXT_PUBLIC_API_URL` (port 4000 locally). It does not call Supabase directly for admin reads.
- Audit pages reuse one shell: `StatCard` / `DataTable` / `useTableParams` (see `pages/documents/stale.tsx`). Do not grow a second table stack.
