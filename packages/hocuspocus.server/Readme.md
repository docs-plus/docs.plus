# @docs.plus/hocuspocus

Backend services for docs.plus — REST API, WebSocket server, and background workers.

## Services

| Service       | Port | Entry Point                | Purpose                              |
| ------------- | ---- | -------------------------- | ------------------------------------ |
| **REST API**  | 4000 | `src/index.ts`             | HTTP endpoints (Hono)                |
| **WebSocket** | 4001 | `src/hocuspocus.server.ts` | Real-time collaboration (Hocuspocus) |
| **Worker**    | 4002 | `src/hocuspocus.worker.ts` | Background jobs (BullMQ)             |

## Tech Stack

- **Framework:** Hono (REST), Hocuspocus (WebSocket)
- **Database:** PostgreSQL via Prisma
- **Queue:** BullMQ + Redis
- **Validation:** Zod
- **Logging:** Pino

## Development

```bash
# From monorepo root
make dev-backend        # Start all backend services

# Individual services
bun run dev:rest        # REST API only
bun run dev:hocuspocus.server   # WebSocket only
bun run dev:hocuspocus.worker   # Worker only
```

## Scripts

| Script                    | Description                |
| ------------------------- | -------------------------- |
| `dev:rest`                | Start REST API in dev mode |
| `dev:hocuspocus.server`   | Start WebSocket server     |
| `dev:hocuspocus.worker`   | Start background worker    |
| `start:rest`              | Production REST API        |
| `start:hocuspocus.server` | Production WebSocket       |
| `start:hocuspocus.worker` | Production Worker          |
| `build`                   | Build all services         |
| `lint`                    | Run ESLint                 |
| `test`                    | Run tests                  |
| `prisma:generate`         | Generate Prisma client     |
| `prisma:migrate:dev`      | Run database migrations    |

## Project Structure

```
src/
├── api/                    # REST API layer
│   ├── controllers/        # Request handlers
│   ├── routers/            # Route definitions
│   ├── middleware/         # Auth, validation
│   ├── services/           # Business logic
│   └── utils/              # API utilities
├── config/                 # Environment & Hocuspocus config
├── extensions/             # Hocuspocus extensions
├── lib/                    # Shared libraries
│   ├── email/              # Email gateway & providers
│   ├── push/               # Push notification gateway
│   ├── storage/            # File storage (local/S3)
│   ├── prisma.ts           # Database client
│   ├── redis.ts            # Redis client
│   ├── queue.ts            # BullMQ setup
│   └── logger.ts           # Pino logger
├── middleware/             # Global middleware
├── schemas/                # Zod validation schemas
├── types/                  # TypeScript types
├── utils/                  # Shared utilities
├── index.ts                # REST API entry
├── hocuspocus.server.ts    # WebSocket entry
└── hocuspocus.worker.ts    # Worker entry
```

## API Documentation

See [API.md](./API.md) for full REST API documentation.

## Environment Variables

Key variables (see `.env.example` in root):

```bash
# Server
APP_PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=...

# Email (optional)
EMAIL_PROVIDER=smtp
SMTP_HOST=...
SMTP_PORT=587

# Push (optional)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

## Testing

```bash
bun run test              # Run all tests
bun run test:watch        # Watch mode
bun run test:coverage     # With coverage
```

---

See [root README](../../README.md) for full setup instructions.
