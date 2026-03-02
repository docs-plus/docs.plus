# 📚 docs.plus

[![Version](https://img.shields.io/badge/version-2.0.0-green.svg)](https://docs.plus)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-green.svg)](https://github.com/docs-plus/docs.plus/pulls)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.com/invite/25JPG38J59)
[![Supabase](https://img.shields.io/badge/Supabase-Powered-3ECF8E.svg?logo=supabase&logoColor=white)](https://supabase.com)
[![Bun](https://img.shields.io/badge/Bun-Runtime-000000.svg?logo=bun&logoColor=white)](https://bun.sh)

docs.plus is a free, real-time collaboration tool built on open-source technologies. It empowers communities to share and organize information logically and hierarchically, making teamwork and knowledge sharing straightforward and effective.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────┐    ┌──────────────────┐    ┌────────────────────┐   │
│   │     Webapp       │    │  Admin Dashboard │    │  TipTap Extensions │   │
│   │    (Next.js)     │    │    (Next.js)     │    │  hyperlink, media  │   │
│   │    Port 3000     │    │    Port 3100     │    │   indent, code     │   │
│   └────────┬─────────┘    └────────┬─────────┘    └────────────────────┘   │
│            │                       │                                         │
└────────────┼───────────────────────┼─────────────────────────────────────────┘
             │ HTTP/WS               │ HTTP
             ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│   │    REST API      │    │    WebSocket     │    │     Worker       │     │
│   │     (Hono)       │    │   (Hocuspocus)   │    │    (BullMQ)      │     │
│   │    Port 4000     │    │    Port 4001     │    │    Port 4002     │     │
│   │                  │    │                  │    │                  │     │
│   │  • Auth          │    │  • Real-time     │    │  • Doc storage   │     │
│   │  • Documents     │    │    collaboration │    │  • Email queue   │     │
│   │  • Workspaces    │    │  • Y.js sync     │    │  • Push notifs   │     │
│   └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘     │
│            │                       │                       │                │
└────────────┼───────────────────────┼───────────────────────┼────────────────┘
             │                       │                       │
             ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌───────────────────────────────┐    ┌───────────────────────────────┐   │
│   │         PostgreSQL            │    │            Redis              │   │
│   │         (Supabase)            │    │                               │   │
│   │         Port 5432             │    │         Port 6379             │   │
│   │                               │    │                               │   │
│   │  • Users & Auth               │    │  • Job queues (BullMQ)        │   │
│   │  • Documents & Workspaces     │    │  • Pub/Sub (WS sync)          │   │
│   │  • Realtime subscriptions     │    │  • Session cache              │   │
│   │  • Row Level Security         │    │  • Rate limiting              │   │
│   └───────────────────────────────┘    └───────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                           ┌─────────────────┐
                           │ Supabase Studio │
                           │  Port 54323     │
                           │  (Dev only)     │
                           └─────────────────┘
```

**Monorepo Structure:**

- 🌐 `packages/webapp` - Next.js frontend with TipTap editor
- 🖥️ `packages/admin-dashboard` - Admin panel for platform management
- ⚡ `packages/hocuspocus.server` - REST API, WebSocket server, and background workers
- 🗄️ `packages/supabase` - Database migrations and Supabase configuration
- 🔌 `packages/extension-*` - TipTap extensions (hyperlink, multimedia, indent, inline-code)
- 📦 `packages/eslint-config` - Shared ESLint configurations

**Tech Stack:**

- **Runtime**: 🚀 Bun 1.3.7+
- **Frontend**: ⚛️ Next.js 15/16, React 19, TipTap 3, Tailwind CSS 4
- **Backend**: 🔧 Hono, Hocuspocus (Y.js), BullMQ, Prisma ORM
- **Database**: 🐘 PostgreSQL 17, 🔴 Redis
- **Infrastructure**: 🐳 Docker Compose, Supabase
- **Real-time**: 🔌 WebSocket (Hocuspocus), Supabase Realtime

## 📋 Prerequisites

- 🐳 **Docker** & **Docker Compose** v2+ - [Install](https://docs.docker.com/get-docker/)
  - ⚠️ **macOS Silicon users:** Docker Desktop has IO performance issues. Use [OrbStack](https://orbstack.dev/) instead (drop-in replacement, faster, lighter).
- 🚀 **Bun** >=1.3.7 - [Install](https://bun.sh/docs/installation)
- 🗄️ **Supabase CLI** - [Install](https://supabase.com/docs/guides/cli/installation)

## 🚀 Quick Start

### 1️⃣ Clone & Install

```bash
git clone https://github.com/docs-plus/docs.plus.git
cd docs.plus
bun install
```

### 2️⃣ Environment Configuration

**Create environment files based on your development mode:**

```bash
# Required: Create .env.development first (used by Docker dev and as base for local dev)
cp .env.example .env.development
```

**Environment File Mapping:**

| Docker Compose File        | Environment File   | Usage                                            |
| -------------------------- | ------------------ | ------------------------------------------------ |
| `docker-compose.prod.yml`  | `.env.production`  | Production deployment                            |
| `docker-compose.dev.yml`   | `.env.development` | Docker development (all services in containers)  |
| `docker-compose.local.yml` | `.env.local`       | Local development (infra in Docker, apps native) |

**Important Differences:**

**`.env.development`** (Docker Development):

- Uses **Docker service names** for inter-container communication:
  - `SERVER_RESTAPI_URL=http://rest-api:4000/api` (Docker service name)
  - `REDIS_HOST=redis` (Docker service name)
  - `DATABASE_URL` is set by Docker Compose (not in file)

**`.env.local`** (Local Development):

- Uses **localhost** for native apps connecting to Docker infrastructure:
  - `SERVER_RESTAPI_URL=http://localhost:4000/api` (localhost)
  - `REDIS_HOST=localhost` (localhost)
  - `DATABASE_URL=postgresql://...@localhost:5432/...` (explicit connection string)
- **Auto-created** from `.env.development` when you run `make dev-local` or `make infra-up`
- **Gitignored** - safe for local customizations

**Note:** `.env.local` is automatically created from `.env.development` on first run. You only need to create `.env.development` manually.

### 3️⃣ Initialize Supabase

<details>
<summary><strong>🗄️ Option A: Local Supabase Setup (One-time, ~5-10 min)</strong></summary>

**Step 1: Start Supabase** 🚀

```bash
make supabase-start
```

First run downloads Docker images. Verify with `make supabase-status`.

**Step 2: Activate Extensions** 🔌

- Open [Supabase Studio](http://127.0.0.1:54323)
- Go to [Integrations](http://127.0.0.1:54323/project/default/integrations)
- Activate: **pg_cron** and **pgmq (Queues)**

**Step 3: Run Migrations** 📊

- Open [SQL Editor](http://127.0.0.1:54323/project/default/sql/1)
- Execute scripts from `packages/supabase/scripts/` in order: `01-enum.sql` through `17-database-extensions.sql`

**Step 4: Configure Queues** ⚙️

- [Queue Settings](http://127.0.0.1:54323/project/default/integrations/queues/settings) → Enable "Expose Queues via PostgREST"
- [Queues](http://127.0.0.1:54323/project/default/integrations/queues/queues) → Select `message_counter` → Manage permissions
- Enable Select/Insert/Update/Delete for: `authenticated`, `postgres`, `service_role`
- Add RLS policy: "Allow anon and authenticated to access messages from queue"

</details>

<details>
<summary><strong>☁️ Option B: Supabase Cloud Setup</strong></summary>

If you prefer not to run Supabase locally, you can use a cloud project instead:

**Step 1: Create Supabase Project** 🚀

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Copy your project URL and anon key from **Settings → API**

**Step 2: Update Environment Variables** ⚙️
Update `.env.development` with your cloud project credentials:

```bash
# Server-side (containers → Supabase Cloud)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Client-side (browser → Supabase Cloud)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_WS_URL=wss://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Step 3: Configure Extensions & Migrations** 📊
You still need to configure your cloud project:

- Activate **pg_cron** and **pgmq (Queues)** extensions in the Dashboard
- Run SQL scripts from `packages/supabase/scripts/` in order via SQL Editor
- Configure queues and permissions (same as local setup)

**Backend Environment Variables:**

```env
# Supabase connection (for pgmq polling)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# VAPID keys for Web Push
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:support@yourdomain.com
```

Generate VAPID keys: `npx web-push generate-vapid-keys`

See `docs/PUSH_NOTIFICATION_PGMQ.md` for detailed architecture.

**Step 5: Configure OAuth Redirect URLs** 🔐

Go to **Authentication → URL Configuration** in Supabase Dashboard and add your **Redirect URLs**:

```
https://yourdomain.com
https://yourdomain.com/*
https://admin.yourdomain.com
https://admin.yourdomain.com/*
```

Replace `yourdomain.com` with your actual domain.

**Step 6: Add Admin Users** 👤

Only users in the `admin_users` table can access the admin dashboard. Run this SQL to grant access:

```sql
-- Add admin user by email
INSERT INTO public.admin_users (user_id, created_at)
SELECT id, now() FROM auth.users WHERE email = 'your-admin@example.com';

-- Verify admin users
SELECT u.email, a.created_at
FROM public.admin_users a
JOIN auth.users u ON a.user_id = u.id;
```

**Note:** Make sure your Supabase project allows connections from your Docker network or configure network settings accordingly.

</details>

### 4️⃣ Start Development Environment

Choose one of three options:

<details>
<summary><strong>🐳 Option A: Full Docker (Default)</strong></summary>

All services run in Docker containers. Best for consistent environments.

**⚠️ macOS Silicon users:** Docker Desktop has slow IO performance (slow Next.js compile/hot reload). Use [OrbStack](https://orbstack.dev/) instead for better performance.

```bash
make up-dev
```

**Services:** 🎯

- 🌐 Webapp: http://localhost:3000
- 🔌 REST API: http://localhost:4000
- ⚡ WebSocket: ws://localhost:4001
- 👷 Worker: http://localhost:4002
- 🐘 PostgreSQL: localhost:5432
- 🔴 Redis: localhost:6379
- 🗄️ Supabase Studio: http://127.0.0.1:54323

</details>

<details>
<summary><strong>💻 Option B: Local Development (macOS-friendly, No Docker IO)</strong></summary>

**Best for macOS users** - Avoids Docker volume IO performance issues. Only infrastructure (PostgreSQL, Redis) runs in Docker. Apps run natively with hot reload.

**Step 1: Start Infrastructure** 🚀

```bash
make infra-up
```

**Step 2: Start Supabase** 🗄️

```bash
make supabase-start
```

**Step 3: Start Apps** 💻

**Option 3a: All in one command (recommended)**

```bash
bun run dev:local
```

**Option 3b: Separate terminals (better for debugging)**

```bash
# Terminal 1 - Backend REST API
cd packages/hocuspocus.server && bun run dev:rest

# Terminal 2 - Backend WebSocket
cd packages/hocuspocus.server && bun run dev:hocuspocus.server

# Terminal 3 - Backend Worker
cd packages/hocuspocus.server && bun run dev:hocuspocus.worker

# Terminal 4 - Frontend
cd packages/webapp && bun run dev
```

**Or use convenience scripts:**

```bash
bun run dev:backend  # Start all backend services
bun run dev:webapp   # Start frontend only
```

**Environment Variables:**

- ✅ **`.env.local` file** at root - automatically created from `.env.development` on first run
- **`.env.development`** - Used by `docker-compose.dev.yml` (Docker service names: `rest-api:4000`, `redis`)
- **`.env.local`** - Used by `docker-compose.local.yml` and native apps (localhost addresses, gitignored)
- Scripts automatically load root `.env.local`:
  - Backend: Uses `bun --env-file ../../.env.local`
  - Frontend: Uses `dotenv-cli` to load root `.env.local`
- **Key differences:** `.env.local` uses `localhost` instead of Docker service names:
  - `SERVER_RESTAPI_URL=http://localhost:4000/api` (vs `http://rest-api:4000/api` in `.env.development`)
  - `REDIS_HOST=localhost` (vs `redis` in `.env.development`)
  - `DATABASE_URL=postgresql://...@localhost:5432/...` (explicit, vs set by Docker Compose in `.env.development`)
- See **Step 2: Environment Configuration** section above for complete details

**Benefits:**

- ✅ Native file system performance (no Docker volume overhead)
- ✅ Faster hot reload
- ✅ Better debugging experience
- ✅ Lower resource usage

**Access points:**

- 🌐 Webapp: http://localhost:3000
- 🔌 REST API: http://localhost:4000
- ⚡ WebSocket: ws://localhost:4001
- 👷 Worker: http://localhost:4002
- 🐘 PostgreSQL: localhost:5432
- 🔴 Redis: localhost:6379
- 🗄️ Supabase Studio: http://127.0.0.1:54323

**Stop infrastructure:**

```bash
make infra-down
```

</details>

## 🚀 Production Deployment

Production-ready setup for **mid-level scale deployments** (small-medium teams, moderate traffic).

**Architecture:** 🏗️

- 📈 Horizontal scaling: REST API (2), WebSocket (2), Worker (2), Webapp (2)
- 🔀 Traefik v3 reverse proxy with automatic SSL (Let's Encrypt) and load balancing
- ⚡ Resource limits, health checks, and zero-downtime blue-green deploys
- 📊 Production-optimized logging and connection pooling

### Setup

1. **⚙️ Configure Environment**

   ```bash
   cp .env.example .env.production
   ```

   **Important:** `.env.production` is used by `docker-compose.prod.yml` for production deployment.

   Update: database credentials, JWT secret, Supabase URLs, storage credentials, CORS origins.

2. **🔨 Build & Deploy**

   ```bash
   make build
   make up-prod
   ```

3. **📈 Scaling**
   Adjust replicas in `.env.production`:
   ```bash
   REST_REPLICAS=2
   WS_REPLICAS=3
   WORKER_REPLICAS=2
   WEBAPP_REPLICAS=2
   ```

**Production Recommendations:** 💡

- 🗄️ Use managed database (AWS RDS, DigitalOcean, Supabase Cloud)
- 🔒 Configure SSL/TLS certificates
- 📊 Set up monitoring (Prometheus, Grafana)
- 💾 Implement database backups
- 🔐 Secure all secrets and credentials

## 📖 Command Reference

```bash
# Building
make build             # Production build
make build-dev         # Development build
make build-backend-prod   # Backend prod image only
make run-backend-prod-local  # Run backend prod image locally (needs .env.local, ports 4000/4001/4002)

# Running (Full Docker)
make up-prod           # Start production
make up-dev            # Start development (all in Docker)

# Running (Local Development - macOS-friendly)
make infra-up          # Start infrastructure only (postgres, redis)
make infra-down        # Stop infrastructure
make infra-logs        # View infrastructure logs
make dev-local         # Start all services (backend + frontend)
make dev-backend       # Start backend services (REST, WS, Worker)
make dev-webapp        # Start frontend only
make dev-rest          # Start REST API only
make dev-ws            # Start WebSocket server only
make dev-worker        # Start Worker only
make migrate           # Run database migrations

# Management
make down              # Stop services (auto-detects env)
make restart           # Restart services (auto-detects env)
make logs              # All logs
make logs-webapp       # Webapp logs
make logs-backend      # Backend logs
make ps                # Container status
make stats             # Resource usage
make clean             # ⚠️ Cleanup + delete volumes (DATA LOSS!)

# Scaling (production)
make scale-webapp      # Scale webapp to 3 replicas
make scale-hocuspocus  # Scale backend services

# Supabase (uses .env.local)
make supabase-start    # Start local Supabase
make supabase-stop     # Stop local Supabase
make supabase-status   # Show Supabase status
```

Run `make help` for complete command list.

## 📁 Project Structure

```
docs.plus/
├── packages/
│   ├── webapp/              # 🌐 Next.js frontend
│   ├── hocuspocus.server/   # ⚡ REST API, WebSocket, Workers
│   ├── supabase/            # 🗄️ Database migrations
│   └── extension-*/         # 🔌 TipTap extensions
├── docker-compose.dev.yml   # 🐳 Development orchestration
├── docker-compose.prod.yml  # 🚀 Production orchestration
├── Makefile                 # 🛠️ Build & deployment commands
└── .env.example             # ⚙️ Environment template
```

## 🤝 Contributing

PRs welcome! See [contributing guidelines](CONTRIBUTING.md) for details.

**First contribution? Start here:**

- Pick an issue labeled [good first issue](https://github.com/docs-plus/docs.plus/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22) or [help wanted](https://github.com/docs-plus/docs.plus/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22).
- Confirm your setup with `bun run check` before opening a PR.
- Use our issue and PR templates to speed up review.

## 📄 License

MIT License - See [LICENSE.md](LICENSE.md)

## 💬 Support

- 💬 **Discord**: [Join our server](https://discord.com/invite/25JPG38J59)
- 🐦 **Twitter**: [@docsdotplus](https://twitter.com/docsdotplus)
- 🐙 **GitHub**: [docs.plus](https://github.com/docs-plus/docs.plus)
- 📧 **Email**: [contact@newspeak.house](mailto:contact@newspeak.house)

---

<a href="https://patreon.com/docsplus"><img src="https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.vercel.app%2Fapi%3Fusername%3Ddocsplus%26type%3Dpatrons&style=for-the-badge" /></a>
