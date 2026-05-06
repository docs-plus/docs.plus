# @docs.plus/webapp

The main docs.plus web application — a real-time collaborative documentation platform.

## Tech Stack

- **Framework:** Next.js 15 (App Router + Turbopack)
- **UI:** React 19, Tailwind CSS 4, DaisyUI
- **Editor:** TipTap 3 with custom extensions
- **Real-time:** Yjs + Hocuspocus
- **Auth:** Supabase Auth (Google One Tap, Email)
- **State:** Zustand, React Query

## Development

```bash
# From monorepo root
make dev-local          # Full local stack
# OR
bun run dev             # Webapp only (needs backend already running)

# From this directory
bun run dev             # Uses ../../.env.local
```

## Scripts

| Script                 | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `dev`                  | Dev server with Turbopack (loads `.env.local`)            |
| `dev:ci`               | Dev server, no env-file (Docker compose / CI sets env)    |
| `dev:coverage`         | Dev server on :3001 with `CYPRESS_COVERAGE=true`          |
| `build`                | Production build (`.env.production`)                      |
| `build:ci`             | Clean-room build (CI sets env vars)                       |
| `start`                | Standalone server on **Node** (local preview)             |
| `start:prod`           | Standalone server on **Bun**, port 3001 (container entry) |
| `start:stage`          | Standalone server on **Bun**, port 3000 (container entry) |
| `lint` / `lint:fix`    | ESLint                                                    |
| `typecheck`            | `tsc --noEmit`                                            |
| `test`                 | Jest unit tests                                           |
| `test:coverage`        | Jest with coverage                                        |
| `cypress:open`         | Cypress E2E (interactive)                                 |
| `cypress:run`          | Cypress E2E (headless)                                    |
| `cypress:run:coverage` | Cypress E2E (headless) with coverage instrumentation      |

`start` runs on Node (`next start`-style standalone server) for local preview; `start:prod`/`start:stage` run on Bun as container entry points. The runtime asymmetry is deliberate.

## Project Structure

```
src/
├── api/           # API client functions
├── components/    # React components
│   ├── TipTap/    # Editor components
│   ├── ui/        # Shared UI components
│   └── icons/     # Icon components
├── hooks/         # Custom React hooks
├── layouts/       # Page layouts
├── pages/         # Next.js pages (Pages Router)
├── stores/        # Zustand stores
├── styles/        # Global styles
├── types/         # TypeScript types
└── utils/         # Utility functions
```

## Environment Variables

See `.env.example` in the monorepo root. Key variables:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `NEXT_PUBLIC_HOCUSPOCUS_URL` — WebSocket server URL
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google OAuth client ID

## Testing

```bash
# Unit tests (Jest)
bun run test

# E2E tests — parallel (from monorepo root)
bun run test:e2e                    # 4 workers (default)
CYPRESS_PARALLEL=2 bun run test:e2e # custom worker count

# E2E — interactive (single instance)
bun run cypress:open

# Run everything (unit + E2E, report saved to Notes/)
bun run test
```

E2E tests use [cypress-split](https://github.com/bahmutov/cypress-split) to distribute spec files across parallel Cypress instances. Results are aggregated into a dashboard with per-worker stats, timing, and parallelism factor. See [CONTRIBUTING.md](../../CONTRIBUTING.md#-testing) for details.

## Related Packages

- `@docs.plus/hocuspocus` — Backend services
- `@docs.plus/extension-*` — TipTap editor extensions

---

See [root README](../../README.md) for full setup instructions.
