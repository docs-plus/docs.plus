# @docs.plus/admin-dashboard

Admin dashboard for docs.plus — manage users, workspaces, and monitor platform health.

## Tech Stack

- **Framework:** Next.js 16 (Pages Router + Turbopack)
- **UI:** React 19, Tailwind CSS 4, DaisyUI
- **Charts:** Recharts
- **Auth:** Supabase Auth
- **State:** Zustand, React Query

## Development

```bash
# From monorepo root
bun run dev:admin       # Start on port 3100

# From this directory
bun run dev             # Uses ../../.env.local
```

## Scripts

| Script      | Description                                            |
| ----------- | ------------------------------------------------------ |
| `dev`       | Start dev server on port 3100 (local env)              |
| `dev:ci`    | Start dev server on port 3100 (no dotenv; CI sets env) |
| `build`     | Production build (`.env.production`)                   |
| `build:ci`  | Clean-room build (CI sets env vars)                    |
| `start`     | Start standalone server with local env                 |
| `lint`      | Run ESLint                                             |
| `lint:fix`  | Fix ESLint issues                                      |
| `typecheck` | Run `tsc --noEmit`                                     |

## Project Structure

```
src/
├── pages/         # Next.js Pages Router routes + api/
├── components/    # React components (auth, cards, charts, layout, tables, ui, documents)
├── hooks/         # Data + UI hooks (React Query, realtime, table params)
├── services/      # Data layer: api.ts (service_role hocuspocus API) + supabase.ts
├── stores/        # Zustand stores
├── constants/     # Config + navigation
├── lib/           # Supabase browser client
├── types/         # Shared TypeScript types
├── utils/         # Pure helpers (format, export, logger)
└── styles/        # Global styles
```

## Environment Variables

Uses the same env files as the main webapp. Key variables:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key (RLS-bounded; the public client)
- `NEXT_PUBLIC_API_URL` — hocuspocus REST base; serves the admin-gated, service_role stats/audit endpoints
- `NEXT_PUBLIC_APP_URL` — main webapp URL, for "open in app" document links

## Access

Admin dashboard runs on port **3100** by default:

- Local: http://localhost:3100
- Requires admin role in Supabase

---

See [root README](../../README.md) for full setup instructions.
