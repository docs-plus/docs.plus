# 📚 docs.plus

[![Version](https://img.shields.io/badge/version-2.0.0-green.svg)](https://docs.plus)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-green.svg)](https://github.com/docs-plus/docs.plus/pulls)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.com/invite/25JPG38J59)
[![Supabase](https://img.shields.io/badge/Supabase-Powered-3ECF8E.svg?logo=supabase&logoColor=white)](https://supabase.com)
[![Bun](https://img.shields.io/badge/Bun-Runtime-000000.svg?logo=bun&logoColor=white)](https://bun.sh)

docs.plus is a free, real-time collaboration tool built on open-source technologies. It empowers communities to share and organize information logically and hierarchically, making teamwork and knowledge sharing straightforward and effective.

## 🏗️ Architecture

**Monorepo Structure:**
- 🌐 `packages/webapp` - Next.js frontend with TipTap editor
- ⚡ `packages/hocuspocus.server` - REST API, WebSocket server, and background workers
- 🗄️ `packages/supabase` - Database migrations and Supabase configuration
- 🔌 `packages/extension-*` - TipTap extensions (hyperlink, multimedia, indent, inline-code)

**Tech Stack:**
- **Runtime**: 🚀 Bun 1.3.2+
- **Frontend**: ⚛️ Next.js 15, React, TipTap, Tailwind CSS
- **Backend**: 🔧 Hono, Hocuspocus (Y.js), Prisma ORM
- **Database**: 🐘 PostgreSQL 17, 🔴 Redis
- **Infrastructure**: 🐳 Docker Compose, Supabase
- **Real-time**: 🔌 WebSocket (Hocuspocus), Supabase Realtime

## 📋 Prerequisites

- 🐳 **Docker** & **Docker Compose** v2+ - [Install](https://docs.docker.com/get-docker/)
- 🚀 **Bun** >=1.3.2 - [Install](https://bun.sh/docs/installation)
- 🗄️ **Supabase CLI** - [Install](https://supabase.com/docs/guides/cli/installation)

## 🚀 Quick Start

### 1️⃣ Clone & Install

```bash
git clone https://github.com/docs-plus/docs.plus.git
cd docs.plus
bun install
```

### 2️⃣ Environment Configuration

```bash
cp .env.example .env.development
```

Update `.env.development` with your configuration. See `.env.example` for all available variables.

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

**Note:** Make sure your Supabase project allows connections from your Docker network or configure network settings accordingly.

</details>

### 4️⃣ Start Development Environment

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

## 🚀 Production Deployment

Production-ready setup for **mid-level scale deployments** (small-medium teams, moderate traffic).

**Architecture:** 🏗️
- 📈 Horizontal scaling: REST API (2), WebSocket (3), Worker (2), Webapp (2)
- 🔀 Nginx reverse proxy with load balancing
- ⚡ Resource limits and health checks
- 📊 Production-optimized logging and connection pooling

### Setup

1. **⚙️ Configure Environment**
   ```bash
   cp .env.example .env.production
   ```
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

# Running
make up-prod           # Start production
make up-dev            # Start development

# Management
make down              # Stop services (auto-detects env)
make restart           # Restart services (auto-detects env)
make logs              # All logs
make logs-webapp       # Webapp logs
make logs-backend      # Backend logs
make ps                # Container status
make stats             # Resource usage
make clean             # Cleanup (auto-detects env)

# Scaling (production)
make scale-webapp      # Scale webapp to 3 replicas
make scale-hocuspocus  # Scale backend services

# Supabase
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

## 📄 License

MIT License - See [LICENSE.md](LICENSE.md)

## 💬 Support

- 💬 **Discord**: [Join our server](https://discord.com/invite/25JPG38J59)
- 🐦 **Twitter**: [@docsdotplus](https://twitter.com/docsdotplus)
- 🐙 **GitHub**: [docs.plus](https://github.com/nwspk/docs.plus)
- 📧 **Email**: [contact@newspeak.house](mailto:contact@newspeak.house)

---

<a href="https://patreon.com/docsplus"><img src="https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.vercel.app%2Fapi%3Fusername%3Ddocsplus%26type%3Dpatrons&style=for-the-badge" /></a>
