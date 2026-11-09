<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/admin-dashboard` are documented here.

This app is private and ships inside docs.plus, so each heading names the docs.plus release that carried the change. The `version` in its `package.json` is not a release line. Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

## [2.3.0] — 2026-11-09

### Security

- The dashboard runs Next.js 16.4.4, for the October Next.js advisories. Redeploy the dashboard.
- **Error reports stay on the narrow collection baseline.** `@sentry/nextjs` is `11.10.0`, and
  `withSentryConfig` loads from `@sentry/nextjs/config`. Sentry 11 sends cookies and request
  bodies by default. `sentryDataCollection.ts` keeps the version 10 limits, and MCP tool text
  stays off.

### Internal

- The Docker image copies `patches/` and the `packages/pad-url` manifest before the install, so
  `bun install --frozen-lockfile` resolves. `patches/` holds the `@tiptap/y-tiptap` fix for
  [ueberdosis/tiptap#8584](https://github.com/ueberdosis/tiptap/issues/8584). The `pad-url`
  package comes from [#648](https://github.com/docs-plus/docs.plus/issues/648).

## [2.2.0] — 2026-10-22

### Documentation

- The README says that sign-in is Google only and that your user needs an `admin_users` row. It
  links to the local sign-in steps in `CONTRIBUTING.md`.

### Internal

- The Docker image copies the `extensions/extension-mermaid` manifest, so the install resolves
  the sixth extension package.

## [2.1.0] — 2026-10-13

### Added

- **Email setup page ([#423](https://github.com/docs-plus/docs.plus/issues/423)).** It reads
  `GET /api/admin/email/setup`. It names each problem and shows each secret only as set or
  missing. It shows a live connection check, the newest bounce with a masked address, and the
  email DLQ depth. It lists the `.env` lines to add. Send test email sends one mail to your own
  address, at most once a minute. A screen reader announces the test-send result.
- **MCP Usage page.** It reads `GET /api/admin/mcp/usage` and counts tool calls from connected AI
  apps for today, 7 days or 30 days. It shows calls per day, per tool and per app, failed calls,
  and the registered apps. It shows counts only. The server sends `<5` for 1 to 4 people.
- **Digest mail settings on Notifications.** The card sets one mail per document or one combined
  mail, and the HTML size limit from 10 to 102 KB. The default is 90 KB. A failed save shows an
  error and puts the old value back in the field.

### Changed

- The dashboard uses the same `docsplus` and `docsplus-dark` themes as the webapp. The phone menu
  lists the audit pages. The two delete dialogs share one frame and one typed-slug confirm, and
  open with Cancel focused.
- Loading follows the webapp rules ([#463](https://github.com/docs-plus/docs.plus/issues/463),
  [#464](https://github.com/docs-plus/docs.plus/issues/464)). One `Loading` view replaces three
  spinners. Spinners announce a status to screen readers, and refresh icons spin only when the
  user allows motion. Push analytics keeps its real header and frames while the data loads. A
  failed load now shows an error alert, and Refresh is the one retry control.
- The Notifications email gateway card reads the Email setup route and no longer polls, because
  each read runs a live provider check. It gives up after 15 s.
- The push gateway status comes from `GET /api/admin/push/gateway`, with the admin token
  ([#433](https://github.com/docs-plus/docs.plus/issues/433)). The public `/health/push` route is
  gone.

### Fixed

- The dashboard works on your own hosts. Its Content Security Policy allowed only docs.plus and
  supabase.co hosts, so a self-hosted dashboard could not reach its API. It now also allows the
  hosts in `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_GLITCHTIP_DSN`, read
  at build time.
- A delete dialog shows the error when the deletion impact read fails. Before, it showed "No
  owner" and no channels.

### Removed

- The Users page no longer subscribes to the `users` table, and its Live badge is gone
  ([#434](https://github.com/docs-plus/docs.plus/issues/434)). Supabase no longer sends realtime
  events for that table. The page refreshes on demand.

### Internal

- The notifications DLQ type names the summary fields that the route returns
  ([#421](https://github.com/docs-plus/docs.plus/issues/421)). Nothing changes at runtime.
- Dependency updates: Next.js 16.4.0 (from 16.2.12), React 19.3.0 and `@sentry/nextjs` 10.76.2.

## [2.0.1] — 2026-08-31

### Internal

- The Docker image declares `NEXT_PUBLIC_GIT_HASH` below the install, so a new git hash no longer
  invalidates the dependency install on every build.

## [2.0.0] — 2026-08-26

The dashboard dates from 2026-01. This entry lists what it offers at 2.0.0. It runs on Next.js 16
(Pages Router), React 19, Tailwind CSS 4 and daisyUI. It reads admin data from the hocuspocus
REST API on `NEXT_PUBLIC_API_URL`.

### Added

- **Sign-in.** Supabase Auth signs you in, and the `is_admin` RPC decides access. A user who is
  not an admin lands on the unauthorized page.
- **Overview.** Stat cards, daily active users, signups per day, document views, top viewed
  documents, retention, the user lifecycle, the device breakdown and message engagement. A top
  viewed document links to its real slug. A row with no document record is plain text.
- **Users, Documents and Channels.** Users can grant or revoke the admin role. Documents lists
  every document. The Stale Documents audit previews and deletes documents in bulk. When the
  server refuses a document that is no longer stale, the page shows the reason.
- **Notifications, Media Storage and System.** Notifications shows notification and push
  subscription stats. Media Storage audits stored media per workspace. System shows service
  health and database stats.
- **Notification Audit and Ghost Accounts.** Ghost Accounts lists six auth-only ghost types. A
  delete is soft when the account has messages or owned documents, and permanent otherwise. Bulk
  select and export act only on the visible rows.
- **Error reports.** GlitchTip capture through `@sentry/nextjs` runs only when
  `NEXT_PUBLIC_GLITCHTIP_DSN` is set.
