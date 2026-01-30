# @docs.plus/admin-dashboard

Admin dashboard for docs.plus — manage users, workspaces, and monitor platform health.

## Tech Stack

- **Framework:** Next.js 16 (App Router + Turbopack)
- **UI:** React 19, Tailwind CSS 4, DaisyUI
- **Charts:** Recharts
- **Auth:** Supabase Auth
- **State:** Zustand, React Query

## Development

```bash
# From monorepo root
bun run dev:admin       # Start on port 3100

# From this directory
bun run dev:local       # Uses .env.local
```

## Scripts

| Script        | Description                   |
| ------------- | ----------------------------- |
| `dev`         | Start dev server on port 3100 |
| `dev:local`   | Dev with local env vars       |
| `build`       | Production build              |
| `build:local` | Build with local env          |
| `start`       | Start production server       |
| `lint`        | Run ESLint                    |
| `lint:fix`    | Fix ESLint issues             |

## Project Structure

```
src/
├── app/           # Next.js App Router pages
├── components/    # React components
├── lib/           # Utilities and clients
└── styles/        # Global styles
```

## Environment Variables

Uses the same env files as the main webapp. Key variables:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key

## Access

Admin dashboard runs on port **3100** by default:

- Local: http://localhost:3100
- Requires admin role in Supabase

---

See [root README](../../README.md) for full setup instructions.
