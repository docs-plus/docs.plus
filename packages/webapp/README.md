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
make dev-local          # Start all services
# OR
bun run dev:webapp      # Webapp only (needs backend running)

# From this directory
bun run dev:local       # Uses .env.local
```

## Scripts

| Script         | Description                     |
| -------------- | ------------------------------- |
| `dev`          | Start dev server with Turbopack |
| `dev:local`    | Dev with local env vars         |
| `build`        | Production build                |
| `build:local`  | Build with local env            |
| `start`        | Start production server         |
| `lint`         | Run ESLint                      |
| `lint:fix`     | Fix ESLint issues               |
| `test`         | Run Jest tests                  |
| `cypress:open` | Open Cypress E2E                |

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
# Unit tests
bun run test

# E2E tests
bun run cypress:open    # Interactive
bun run cypress:run     # Headless
```

## Related Packages

- `@docs.plus/hocuspocus` — Backend services
- `@docs.plus/extension-*` — TipTap editor extensions

---

See [root README](../../README.md) for full setup instructions.
