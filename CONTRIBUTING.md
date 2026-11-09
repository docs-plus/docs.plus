# Contributing to docs.plus

Pull requests are welcome 🎉. Read [README.md](README.md) for what docs.plus is and how to run it. Read this file for how to change it, and how to get a change merged.

## 🤝 Code of Conduct

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) is the Contributor Covenant. It binds every contributor and every maintainer. Read it before you take part.

## 🚀 Getting Started

Install the tools in [Prerequisites](#-prerequisites) first. Then fork and clone the repository.

### 📋 Prerequisites

- 🐳 **Docker** and **Docker Compose** v2+ - [Install](https://docs.docker.com/get-docker/)
  - ⚠️ **macOS on Apple silicon:** Docker Desktop has slow file IO. Use [OrbStack](https://orbstack.dev/) instead. It is a drop-in replacement, and it is faster and lighter.
- 🚀 **Bun** >=1.4.0 - [Install](https://bun.sh/docs/installation)
- 📦 **Node.js** >=24.11.0 - [Install](https://nodejs.org/). Next.js and the tooling binaries run on Node.
- 🔨 **GNU Make** - every `make` command here needs it. macOS installs it with `xcode-select --install`. Most Linux distributions ship it in a build-tools package.
- 🌱 **Git** - [Install](https://git-scm.com/downloads)
- 🪟 **Windows:** use WSL2, because the dev workflow uses `make` and `bash`.
- 🚫 **Bun only:** never run npm, yarn, pnpm or npx in this repository. `bun.lock` is the only lockfile. Never commit `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`.

You do not need a global Supabase CLI. The repository pins it as a workspace dependency.

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork**:

   ```bash
   git clone https://github.com/YOUR_USERNAME/docs.plus.git
   cd docs.plus
   ```

3. **Add upstream remote**:

   ```bash
   git remote add upstream https://github.com/docs-plus/docs.plus.git
   ```

## 💻 Development Setup

1. **Start the local stack**:

   ```bash
   make dev-local
   ```

   The URLs and the sign-in notes live in the [README section Run the code on your computer](README.md#run-the-code-on-your-computer). To stop or reset the stack, see [Stop and reset](#stop-and-reset). To run every service in containers, see [Full Docker](#full-docker-make-up-dev).

2. **Check the environment** when something is wrong:

   ```bash
   bun run doctor
   ```

   It checks Webapp 3000, Admin Dashboard 3100, REST API 4000, WebSocket Server 4001, Worker 4002, PostgreSQL 5432, Redis 6379, Supabase API 54321 and Supabase Studio 54323.

   The port block never fails. It reports a warning when only some ports are in use, and a warning still exits 0. When it warns, read the `In use` line and start any service you still need.

   An idle 3100 is normal. `make dev-local` starts no Admin Dashboard. Start it with `bun run dev:admin`, as in [Command Reference](#-command-reference).

   `bun run doctor` exits 1 only for a real failure. The failing checks are a Bun version below the floor, a missing `docker` or `docker compose`, a stopped Docker daemon, a missing `.env.development`, and a missing `node_modules`.

3. **Fix a port conflict** when `make dev-local` stops at "Infrastructure failed (Postgres/Redis)" while Docker is running. Read the Docker error printed above that line. If port 5432 or 6379 is already allocated or in use, stop the host Postgres or Redis. Or set `DB_PORT` in `.env.local` and change the port in `DATABASE_URL` to match. For Redis, set `REDIS_PORT` instead.

### Stop and reset

**Stop:** `Ctrl+C` stops the app processes · `make infra-down` stops Postgres/Redis · `bun --filter @docs.plus/supabase_back stop` stops Supabase

**Reset the local Supabase database:** `bun --filter @docs.plus/supabase_back reset`

The local stack runs two databases. That command resets the Supabase database on port 54322 only. The Prisma database `docsplus` runs in the container `docsy-postgres-local` on port 5432, and it survives the reset.

### Full Docker (`make up-dev`)

This path runs all services in containers instead of native processes.

Google sign-in is optional. Local Supabase reads the Google keys from `.env.local` when it starts, and this path does not create that file. To keep the keys in that file, do these three steps first. Otherwise, skip to the start commands.

1. Run `make dev-local` once. It creates `.env.development` and `.env.local`.
2. Wait until it has started the apps, then press `Ctrl+C`. Both stacks use the same ports, such as 3000, 4000 and 5432. So stop its containers and Supabase, from the repository root:

   ```bash
   make infra-down
   bun --filter @docs.plus/supabase_back stop
   ```

3. Add `GOOGLE_CLIENT_ID` and `GOOGLE_SECRET` to `.env.local`. Get both values from the Local stack part of [Turn on Google sign-in](docs/self-hosting/configuration.md#turn-on-google-sign-in).

Then start the stack, from the repository root. Skip the `cp` line when `.env.development` already exists, or it overwrites your edits.

```bash
bun install
cp .env.example .env.development
make up-dev
bun --filter @docs.plus/supabase_back start
```

`make up-dev` starts no Supabase. The containers read `SUPABASE_URL: http://host.docker.internal:54321` from the host, so the last command supplies it. That command also opens Supabase Studio at <http://127.0.0.1:54323>.

If you skipped the three steps, you can still turn on Google sign-in. Export the two keys in your shell, then restart Supabase. Run this from the repository root:

```bash
bun --filter @docs.plus/supabase_back stop
export GOOGLE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>
export GOOGLE_SECRET=<YOUR_GOOGLE_SECRET>
bun --filter @docs.plus/supabase_back start
```

Get both values from the Local stack part of [Turn on Google sign-in](docs/self-hosting/configuration.md#turn-on-google-sign-in).

**URLs:** see [All local addresses](README.md#run-the-code-on-your-computer) in the README.

### Supabase Cloud for local development

You can use a hosted Supabase project instead of local Supabase. With `make up-dev`, no local Supabase starts. But `docker-compose.dev.yml` fixes `SUPABASE_URL` to local Supabase for the webapp and admin containers. So with Supabase Cloud, use `make dev-local`. `make dev-local` still starts and checks local Supabase, but the apps use the cloud values in `.env.local`.

Put your project values in `.env.development` and in the generated `.env.local`. Run `make dev-local` once before you edit, so it creates `.env.local`. When it creates `.env.local` again, it sets `SUPABASE_URL` back to local Supabase, so set it again.

```bash
# Server-side (local app processes → Supabase Cloud)
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>

# Client-side (browser → Supabase Cloud)
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_WS_URL=wss://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
```

`<PROJECT_REF>`, `<SUPABASE_ANON_KEY>` and `<SUPABASE_SERVICE_ROLE_KEY>` come from **Settings → API** in the Supabase Dashboard.

Then set up the project with the self-hosting pages:

- Extensions and schema: [Install step 2](docs/self-hosting/install.md#2-prepare-supabase).
- Push notifications, optional: [Turn on push notifications](docs/self-hosting/configuration.md#turn-on-push-notifications). Put the keys in `.env.development` and `.env.local`, not `.env.production`. Then restart the whole stack: stop `make dev-local` and start it again.
- Site URL and redirect URLs: [Install step 2](docs/self-hosting/install.md#2-prepare-supabase).
  For local development, set Site URL to `http://localhost:3000` and add `http://localhost:3100/` under Redirect URLs.
- Admin user: [Make yourself an admin](docs/self-hosting/install.md#10-make-yourself-an-admin).

### Sign in to the admin dashboard locally

The admin dashboard at <http://localhost:3100> signs in with Google only. Local sign-in needs two steps.

1. Set up the Google keys. Follow the Local stack part of [Turn on Google sign-in](docs/self-hosting/configuration.md#turn-on-google-sign-in).
2. Sign in to the webapp once with Google, so your user exists. Then add an `admin_users` row for that user. The SQL is in [Make yourself an admin](docs/self-hosting/install.md#10-make-yourself-an-admin). Run it in the SQL editor of local Supabase Studio at <http://127.0.0.1:54323>.

## 📖 Command Reference

```bash
# Running (local apps on host)
make dev-local         # Full local stack (bootstraps everything)
make dev-backend       # Backend only
make infra-up          # Start Postgres + Redis only
make infra-down        # Stop Postgres + Redis
bun --filter @docs.plus/supabase_back stop   # Stop Supabase

# Running (all services in Docker)
make up-dev            # Development
make up-prod           # Production

# Building
make build             # Production images
make build-dev         # Development images

# Other Bun entrypoints
bun run dev                                          # Webapp only
bun run dev:admin                                    # Admin dashboard
bun run doctor                                       # Environment health check

# Management
make down              # Stop services (auto-detects env)
make logs              # All logs (auto-detects env)
make ps                # Container status
make clean             # Cleanup + delete volumes (DATA LOSS)
```

Run `make dev-local` first on a new clone. On the first run it writes `.env.development` from `.env.example`. It then writes `.env.local` from that file, with localhost hostnames and `DATABASE_URL`, because native apps cannot resolve Docker service names. Both files are gitignored. Edit `.env.local` for local changes, such as Google keys. The comments in [.env.example](.env.example) explain each value.

`make infra-up` copies `.env.development` as it is, so an `.env.local` that it creates does not work for native apps. If that happened, delete `.env.local` and run `make dev-local` again.

`make help` lists the day-to-day surface, not every target. It omits `run-prod-backend`, `observability-up`, `observability-down`, `observability-logs` and `observability-pull`. The four `observability-*` targets run on the production droplet. `run-prod-backend` runs the production backend images locally against `.env.local`. Run `bun run` with no arguments for all root scripts.

## 📁 Project Structure

```
docs.plus/
├── apps/
│   ├── webapp/                  # 🌐 Next.js frontend
│   │   ├── src/
│   │   │   ├── components/      # React components
│   │   │   ├── api/             # API clients
│   │   │   ├── hooks/           # React hooks
│   │   │   ├── stores/          # State management
│   │   │   └── utils/           # Utility functions
│   │   └── cypress/             # E2E tests
│   ├── hocuspocus.server/       # ⚡ REST API, WebSocket, Workers
│   │   ├── src/
│   │   │   ├── api/             # REST API routes & controllers
│   │   │   ├── lib/             # Shared libraries (email, push, etc.)
│   │   │   ├── middleware/      # Hono middleware
│   │   │   └── config/          # Configuration & env schemas
│   │   └── prisma/              # Prisma schema & migrations
│   └── admin-dashboard/         # 🖥️ Admin interface (Next.js)
├── extensions/
│   └── extension-*/             # 🔌 Publishable @docs.plus Tiptap packages
├── packages/
│   ├── document-swarm/          # 🐝 Multi-user demo and load CLI (Playwright)
│   ├── email-templates/         # ✉️ Email templates and rendering
│   ├── eslint-config/           # 🧹 Shared ESLint configuration
│   ├── floating-popover/        # 🎈 Popover lifecycle engine
│   ├── floating-tooltip/        # 💬 Hover/focus tooltip primitive
│   ├── pad-url/                 # 🔗 Pad link format, shared by webapp and server
│   ├── playground/              # 🧪 Clean-room Cypress harness
│   ├── release-tooling/         # 📦 Shared prepack and publish guards
│   └── supabase/                # 🗄️ Database schema, seed, migrations
├── .github/workflows/           # 🔄 CI/CD pipelines
├── docker-compose.dev.yml       # 🐳 Development orchestration
├── docker-compose.prod.yml      # 🚀 Production orchestration
├── Makefile                     # 🛠️ Build & deployment commands
└── .env.example                 # ⚙️ Environment template
```

Deeper layout lives in `apps/webapp/README.md`, `apps/hocuspocus.server/Readme.md` and each area's `CLAUDE.md`.

## 🎯 Areas for Contribution

Pick from any of these:

- 🐛 **Bug Fixes**: Fix issues reported in GitHub Issues
- ✨ **Features**: Implement new features (check Issues for ideas)
- 📚 **Documentation**: Improve docs, add examples, fix typos
- 🧪 **Tests**: Pin a reported regression with a Cypress E2E test
- 🎨 **UI/UX**: Improve design, accessibility, user experience. UI work follows the locked design system in [.cursor/docs/design-system.md](.cursor/docs/design-system.md). Do not add or change a token, color, radius or shadow; open an issue first.
- ⚡ **Performance**: Optimize code, reduce bundle size
- 🔒 **Security**: Report or fix security issues
- 🔌 **Extensions**: Work on one of the `@docs.plus/extension-*` packages

Extension work has its own per-package scoping. That scoping lives in [extensions/README.md](extensions/README.md#contributing). [Testing](#-testing) below states what the extension gates cost to run.

## ✏️ Making Changes

The repository layout lives in [Project Structure](#-project-structure).

### Project rules (and AI coding agents)

The repository's durable conventions live in [`AGENTS.md`](AGENTS.md) — package manager, commit policy, code quality, test policy. Rules that apply to one area live in that area's `CLAUDE.md`: `apps/webapp/`, `apps/hocuspocus.server/`, `apps/admin-dashboard/`, `packages/supabase/`, `extensions/`, plus the two nested files `apps/webapp/src/components/TipTap/CLAUDE.md` and `apps/webapp/src/components/chatroom/CLAUDE.md`. [`AGENTS.md`](AGENTS.md) §Filed by directory maps every section to its file.

Two more rule files are outside that set. [`CONTEXT.md`](CONTEXT.md) at the repository root is the domain glossary. [`extensions/extension-hyperlink/AGENTS.md`](extensions/extension-hyperlink/AGENTS.md) is package-local, and you read it in addition to the root file when you work inside that package.

Claude Code loads a directory's `CLAUDE.md` when it reads a file under that path. Cursor does not read `CLAUDE.md` at all, so Cursor gets the same rules through [`.cursor/rules/agent-rules-and-memory.mdc`](.cursor/rules/agent-rules-and-memory.mdc). Skim the files that cover the area you change.

`bun run check:agent-docs` verifies that every cross-reference between those files still resolves. It runs as part of `bun run check`.

### Branch Naming

Create a new branch for your changes:

```bash
git checkout -b type/description
```

**Branch naming conventions:**

- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `test/` - Test additions/updates
- `chore/` - Maintenance tasks

**Examples:**

- `feature/add-dark-mode`
- `fix/resolve-memory-leak`
- `docs/update-api-docs`

Branch names are a convention. No hook and no workflow check them.

### Commit Messages

This repository follows the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** The `commit-msg` hook accepts these eleven types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting or whitespace only
- `refactor`: Code refactoring, renames included
- `perf`: Performance work
- `test`: Adding or updating tests
- `build`: Build system or toolchain changes
- `ci`: CI configuration changes
- `chore`: Maintenance tasks, and `chore(deps)` for dependency bumps
- `revert`: Revert of an earlier commit

The hook checks the shape of the first line only. That line must be 72 characters or less. A scope
uses lowercase letters, digits, dots and hyphens. The hook rejects the `!` marker, so put
`BREAKING CHANGE:` in the footer. It also rejects a `Co-authored-by:` line that names an AI
tool or uses an AI vendor's email domain. It rejects any `Generated-by:`, `Made-with:` or
`Assisted-by:` line, and a "Generated with [Claude Code]", "[Codex]" or "[Cursor]" banner. Turn
off your editor's or agent's commit attribution. A `Co-authored-by:` line for a human co-author is
fine.

**Examples:**

```
feat(webapp): add dark mode toggle
fix(api): resolve memory leak in document sync
docs(readme): update installation instructions
refactor(editor): simplify toolbar component
```

`(build): …` is a separate form. It is a maintainer-only production deploy trigger, parsed by `.github/scripts/parse-build-trigger.sh`, and a contributor never uses it.

## 🎨 Code Style

### Formatting

Prettier formats the code. Check formatting:

```bash
bun run format
```

Or auto-fix formatting:

```bash
bun run format:fix
```

### Linting

ESLint checks code quality. Fix the findings:

```bash
bun run lint:fix
```

### Git Hooks (Husky)

Husky runs local quality gates before code reaches a remote branch.

- `.husky/*` contains lightweight wrapper scripts.
- `scripts/hooks/*.sh` contains the actual hook logic.
- Active hooks:
  - `pre-commit`: runs `bun run lint-staged` (staged-file lint and format checks, Prettier included)
  - `commit-msg`: validates commit message format
  - `pre-push`: refuses the push if a Next development server is live, then runs `bun run check:ci`
  - `post-merge`: runs `bun install` when `package.json` or `bun.lock` changes

Run the push gate without pushing:

```bash
bun run pre-push
```

That script runs the same husky hook: it stops if a Next development server is live, then runs `bun run check:ci`. The clean-room extension suites can take a long time.

Trigger the other two hooks by hand. Run both from inside the repository, because each wrapper resolves the repository root with `git rev-parse --show-toplevel` and exits 1 when it cannot.

```bash
# pre-commit (staged file checks)
sh .husky/pre-commit

# commit message validation
echo "feat(webapp): verify hook docs" > /tmp/commit-msg.txt
sh .husky/commit-msg /tmp/commit-msg.txt
```

### TypeScript

- Use TypeScript for all new code
- Avoid `any` types - use proper types or `unknown`
- Enable strict mode in your IDE
- Run type checking: `bun run typecheck`

### Quality commands (summary)

Full naming convention: [.cursor/docs/scripts-naming-convention.md](./.cursor/docs/scripts-naming-convention.md). Quick reference:

| Command                    | Use case                                                                      |
| -------------------------- | ----------------------------------------------------------------------------- |
| `bun run check`            | Full local report: lint + lint:styles + format + typecheck + check:agent-docs |
| `bun run check:ci`         | Local replica of the prod quality gates. Husky pre-push runs this.            |
| `bun run check:push`       | Fast local gate: lint + lint:styles + typecheck (no format)                   |
| `bun run check:fix`        | Auto-fix all: ESLint + Stylelint + Prettier (in that order)                   |
| `bun run lint`             | ESLint report                                                                 |
| `bun run lint:fix`         | ESLint --fix                                                                  |
| `bun run lint:styles`      | Stylelint report                                                              |
| `bun run lint:styles:fix`  | Stylelint --fix                                                               |
| `bun run format`           | Prettier --check                                                              |
| `bun run format:fix`       | Prettier --write                                                              |
| `bun run typecheck`        | tsc --noEmit (report only — no fix)                                           |
| `bun run lint-staged`      | Staged-file lint/format, run by the `pre-commit` hook                         |
| `bun run check:agent-docs` | Cross-reference check across `AGENTS.md`, `CONTEXT.md` and every `CLAUDE.md`  |

## 🧪 Testing

### Running All Tests

```bash
bun run test              # extension gates + webapp Jest + E2E, report saved to Notes/
bun run test:unit         # extension gates + webapp Jest
bun run test:e2e          # E2E only (4 workers) — needs BASE_URL, see E2E Tests below
```

`bun run test:unit` is not a unit-only run. It runs the gate of every `@docs.plus/extension-*` package. Each gate builds its package, then runs a clean-room Cypress suite in a browser. `bun run test:unit` then runs the webapp Jest suite. Budget about 45 minutes. `bun run test` inherits the same cost.

`bun run test` and `bun run test:e2e` both need a running local stack, and both need a `BASE_URL` override. See [E2E Tests](#e2e-tests) below before you run either one. An unreachable `BASE_URL` makes the script print `Continue anyway? [y/N]`, and it aborts on any answer other than `y` or `Y`.

When one extension gate fails, run that package's gate on its own. The `EXT_ONLY` scoping lives in [extensions/README.md](extensions/README.md#contributing). The clean-room port for each package lives in the package table at the top of that same file.

### Unit Tests

Run the webapp Jest suite on its own:

```bash
bun run --filter @docs.plus/webapp test
```

That skips the extension gates.

### E2E Tests

`bun run test:e2e` runs every Cypress spec under `apps/webapp/cypress/e2e/`, which today means `auth/`, `chatroom/`, `document/` and `editor/`. The run fails when the number of specs the workers ran does not match the number of spec files on disk. Those specs run in **parallel** across multiple workers using [cypress-split](https://github.com/bahmutov/cypress-split). cypress-split splits spec files across N Cypress instances for faster feedback.

```bash
# Interactive mode (single instance)
bun run --filter @docs.plus/webapp cypress:open

# Interactive against a port-3000 stack, from the repository root
bunx cypress open --project apps/webapp --config baseUrl=http://localhost:3000

# Headless — parallel (default 4 workers)
BASE_URL=http://localhost:3000 bun run test:e2e

# Custom worker count via env var
CYPRESS_PARALLEL=2 bun run test:e2e
CYPRESS_PARALLEL=6 bun run test:e2e
CYPRESS_PARALLEL=8 bun run test:e2e
```

> **Before you run E2E:** Start the local stack. `make dev-local` serves the webapp on port 3000. Read the `WEBAPP` line in the `make dev-local` output to confirm the real port, because Next moves to the next free port when 3000 is busy. `scripts/run-tests.sh` defaults `BASE_URL` to `http://localhost:3001`, so pass the port yourself: `BASE_URL=http://localhost:3000 bun run test:e2e`.

`BASE_URL` reaches `bun run test` and `bun run test:e2e` only. `cypress:open` is a bare `bunx cypress open`, and `apps/webapp/cypress.config.ts` sets no `baseUrl`. Specs that call `visitEditor` still reach `http://localhost:3001`, through the fallback in `apps/webapp/cypress/support/commands.ts`. A relative `cy.visit` has no base URL to resolve against, so pass `--config baseUrl=http://localhost:3000`, the same flag `scripts/run-tests.sh` uses.

**Choosing a worker count:**

| Workers | RAM needed | Best for                               |
| ------- | ---------- | -------------------------------------- |
| 2       | ~1 GB      | Low-resource machines, CI containers   |
| 4       | ~2 GB      | Default — good balance on most laptops |
| 8       | ~4 GB      | 16 GB+ RAM, 8+ cores                   |

After a run you get an aggregated report with per-worker stats, timing breakdown, and parallelism factor. `scripts/run-tests.sh` saves that report to `Notes/test-results-*.txt`.

### Before You Add a Test

Default: do not add a test. Add one only in these three cases.

1. A maintainer asks for it.
2. The change pins a regression that shipped or was reported.
3. The failure mode is a real branching, ordering, race, parsing or projection bug.

Name that failure mode in one sentence in your pull request. If you cannot name it, leave the test out.

When your change adds no test, `bun run check` plus a manual check of the changed surface is the bar. State in the pull request which check you ran.

Prefer Cypress E2E over unit tests. Write a unit test only for parsers, projections, schema validators and pure utilities. Run any test you add and watch it pass.

When a test is warranted:

- Test behavior, not implementation
- Use descriptive names that describe behavior, never a ticket ID
- Keep tests focused

[`AGENTS.md`](AGENTS.md) §Test Policy is the authority here. It also lists the test shapes that maintainers always delete.

## 🐘 Database Changes

A schema change has three steps. Local Supabase must run for steps 2 and 3.

1. Edit the canonical SQL in `packages/supabase/scripts/*.sql`. Add a paired file under `packages/supabase/migrations/` for the remote push. Local Supabase does not run migrations; it seeds from `scripts/` only.
2. Apply the change to local Supabase. `reset` rebuilds `packages/supabase/seed.sql` from `scripts/` and re-applies it. Run it from the repository root:

   ```bash
   bun run --filter @docs.plus/supabase_back reset
   ```

   `reset` wipes all local Supabase data. To keep that data, apply the one file instead, as [`packages/supabase/CLAUDE.md`](packages/supabase/CLAUDE.md) describes.

3. Regenerate the Supabase types. `types` reads the running local database, so run it after step 2. Run it from the repository root:

   ```bash
   bun run --filter @docs.plus/supabase_back types
   ```

`packages/supabase/seed.sql` and `apps/webapp/src/types/supabase.ts` are generated output. Never hand-edit either file. Include both regenerated files in the same change.

Other scripts in the package include `start`, `stop`, `status` and `seed`. Run each as `bun --filter @docs.plus/supabase_back <SCRIPT>`. Both `bun --filter` and `bun run --filter` work, so this form and the form in steps 2 and 3 match.

The SQL, migration and RLS rules live in [`packages/supabase/CLAUDE.md`](packages/supabase/CLAUDE.md). Read it before you write SQL.

## 🐳 Docker Images

When you add or change a **Dockerfile**, for a new service or a new image:

- **Monorepo, no flatten:** Keep the workspace layout (`apps/<name>`, `extensions/<name>`, `packages/<name>`) in the image; do not copy a single package to `/app` and discard the rest.
- **One `bun install` per stage;** do not copy `node_modules` between stages (Bun symlinks break).
- **Minimal copy set:** Root workspace files + full copies only of packages the service needs; use stub `package.json` for other workspaces so the lockfile resolves.

Copy a new workspace member's `package.json` into all three Dockerfiles — `apps/webapp/docker/Dockerfile.bun`, `apps/hocuspocus.server/docker/Dockerfile.bun` and `apps/admin-dashboard/docker/Dockerfile.bun` — before any `--frozen-lockfile` install.

## 📤 Submitting Changes

A merged contribution ships under the repository license, MIT. Read [LICENSE](LICENSE) before you submit.

### Before Submitting

1. **Update your fork**:

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Rebase your branch** (if needed):

   ```bash
   git checkout your-branch
   git rebase main
   ```

3. **Run checks** before opening a pull request:

   ```bash
   bun run check:ci
   ```

   That command is the local replica of the prod quality gates. It prints pass / fail / skip for each gate.

   `bun run check` still covers `check:agent-docs`, which CI does not run. Husky pre-push runs `bun run check:ci`. `bun run check:push` is the fast local lint + styles + typecheck gate. CI runs `bun run lint`, `bun run format` and `bun run lint:styles` in one job, and `bun run typecheck` in a second job.

4. **Test locally**:
   - Start the local stack
   - Test your changes manually
   - Verify no regressions

### Creating a Pull Request

1. **Push your branch**:

   ```bash
   git push origin your-branch                       # first push
   git push --force-with-lease origin your-branch    # after a rebase
   ```

   A rebase rewrites the branch history, so the remote rejects a plain push to a branch you already pushed. Never use `--force`.

2. **Create a pull request** on GitHub:
   - Use a clear, descriptive title
   - Fill out the pull request template at `.github/PULL_REQUEST_TEMPLATE.md`
   - Reference any related issues
   - Add screenshots/GIFs for UI changes

3. **Pull request checklist**:
   - [ ] Code follows style guidelines
   - [ ] `bun run check:ci` passes
   - [ ] Every test I added passes
   - [ ] Documentation updated (if needed)
   - [ ] No console errors/warnings
   - [ ] Changes are backward compatible (if applicable)

### Pull Request Review Process

- A maintainer reviews your pull request
- Address feedback promptly
- Keep each pull request focused and reasonably sized
- Be open to suggestions and improvements

CI on a fork pull request starts only after a maintainer approves the run. The chatroom browser tests need a commercial license secret, so they skip fork pull requests and run on `main` after merge.

## 💡 Getting Help

Every channel, and what each one is for, is in the README's [Community and support](README.md#community-and-support) table. Report a vulnerability through [SECURITY.md](SECURITY.md), never in a public issue.

Ask in Discord before you start a large change. A maintainer can tell you early whether the idea fits.

## 🙏 Thank You

Your contributions make docs.plus better for everyone. Thank you for taking the time to contribute! ❤️
