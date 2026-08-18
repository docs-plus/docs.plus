# Contributing to docs.plus

Pull requests are welcome 🎉. Read [README.md](README.md) for what docs.plus is and how to run it. Read this file for how to change it, and how to get a change merged.

## 🤝 Code of Conduct

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) is the Contributor Covenant. It binds every contributor and every maintainer. Read it before you take part.

## 🚀 Getting Started

Install Docker, Bun and Node.js first. [README Prerequisites](README.md#-prerequisites) lists the versions, the macOS and Windows notes, and the Bun-only rule.

- **Git** - [Install](https://git-scm.com/downloads)

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

   URLs, sign-in notes, stop commands and the full-Docker alternative live in the [README Quick Start](README.md#-quick-start).

2. **Check the environment** when something is wrong:

   ```bash
   bun run doctor
   ```

   It checks Webapp 3000, Admin Dashboard 3100, REST API 4000, WebSocket Server 4001, Worker 4002, PostgreSQL 5432, Redis 6379, Supabase API 54321 and Supabase Studio 54323.

   The port block never fails. It reports a warning when only some ports are in use, and a warning still exits 0. When it warns, read the `In use` line and start any service you still need.

   An idle 3100 is normal. `make dev-local` starts no Admin Dashboard. Start it with `bun run dev:admin` from the [README Command Reference](README.md#-command-reference).

   `bun run doctor` exits 1 only for a real failure. The failing checks are a Bun version below the floor, a missing `docker` or `docker compose`, a stopped Docker daemon, a missing `.env.development`, and a missing `node_modules`.

## 🎯 Areas for Contribution

Pick from any of these:

- 🐛 **Bug Fixes**: Fix issues reported in GitHub Issues
- ✨ **Features**: Implement new features (check Issues for ideas)
- 📚 **Documentation**: Improve docs, add examples, fix typos
- 🧪 **Tests**: Pin a reported regression with a Cypress E2E test
- 🎨 **UI/UX**: Improve design, accessibility, user experience
- ⚡ **Performance**: Optimize code, reduce bundle size
- 🔒 **Security**: Report or fix security issues
- 🔌 **Extensions**: Work on one of the five `@docs.plus/extension-*` packages

Extension work has its own per-package scoping. That scoping lives in [extensions/README.md](extensions/README.md#contributing). [Testing](#-testing) below states what the extension gates cost to run.

## ✏️ Making Changes

The repository layout lives in [README Project Structure](README.md#-project-structure).

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
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance work
- `test`: Adding or updating tests
- `build`: Build system or dependency changes
- `ci`: CI configuration changes
- `chore`: Maintenance tasks
- `revert`: Revert of an earlier commit

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
  - `pre-push`: runs selective build checks, then always runs `bun run check:push` (lint + lint:styles + typecheck)
  - `post-merge`: runs `bun install` when `package.json` or `bun.lock` changes

Run the push gate without pushing:

```bash
bun run pre-push
```

That script runs `bun run check:push` and no build. The git hook itself also runs the selective extension, admin-dashboard and webapp builds, so the hook takes minutes.

For the same quality gates GitHub Actions runs, call this before you push (opt-in; not the hook):

```bash
bun run check:ci
```

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
| `bun run check:ci`         | Local replica of the prod quality gates. Run this before you push.            |
| `bun run check:push`       | Pre-push hook: lint + lint:styles + typecheck (no format)                     |
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

`bun run test:unit` is not a unit-only run. It runs the five `@docs.plus/extension-*` extension gates. Each gate builds its package, then runs a clean-room Cypress suite in a browser. `bun run test:unit` then runs the webapp Jest suite. Budget about 45 minutes. `bun run test` inherits the same cost.

`bun run test` and `bun run test:e2e` both need a running local stack, and both need a `BASE_URL` override. See [E2E Tests](#e2e-tests) below before you run either one. An unreachable `BASE_URL` makes the script print `Continue anyway? [y/N]`, and it aborts on any answer other than `y` or `Y`.

When one extension gate fails, run that package's gate on its own. The `EXT_ONLY` scoping lives in [extensions/README.md](extensions/README.md#contributing). The clean-room port for each package lives in the package table at the top of that same file.

### Unit Tests

Run the webapp Jest suite on its own:

```bash
bun run --filter @docs.plus/webapp test
```

That skips the five extension gates.

### E2E Tests

`bun run test:e2e` runs every Cypress spec under `apps/webapp/cypress/e2e/`, which today means `editor/`, `chatroom/` and `document/`. The run fails when the number of specs the workers ran does not match the number of spec files on disk. Those specs run in **parallel** across multiple workers using [cypress-split](https://github.com/bahmutov/cypress-split). cypress-split splits spec files across N Cypress instances for faster feedback.

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

> **Before you run E2E:** Start the local stack. `make dev-local` serves the webapp on port 3000. Read the `WEBAPP` line in the `make dev-local` output to confirm the real port, because Next moves to the next free port when 3000 is busy. `scripts/run-tests.sh` defaults `BASE_URL` to `http://localhost:3001`, so pass the port yourself: `BASE_URL=http://localhost:3000 bun run test:e2e`. One spec, `apps/webapp/cypress/e2e/document/draft-first-edit-anchor.cy.ts`, hardcodes `http://localhost:3001` and ignores `BASE_URL`, so it fails against a port-3000 stack until a maintainer fixes it.

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

After a SQL change, regenerate the Supabase types:

```bash
bun run --filter @docs.plus/supabase_back types
```

`apps/webapp/src/types/supabase.ts` is generated output. Never hand-edit it. Include the regenerated file in the same change.

Run the other scripts in the same package with `bun --filter @docs.plus/supabase_back <script>`: `start`, `stop`, `status`, `reset` and `seed`. Both `bun --filter` and `bun run --filter` work, so the README form and this form match.

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

   `bun run check` still covers `check:agent-docs`, which CI does not run. Pre-push stays `bun run check:push` (lint + lint:styles + typecheck; no full-repo Prettier). CI runs `bun run lint`, `bun run format` and `bun run lint:styles` in one job, and `bun run typecheck` in a second job.

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

## 💡 Getting Help

- 💬 **Discord**: [Join our server](https://discord.com/invite/25JPG38J59) for real-time help
- 🐛 **Issues**: [GitHub Issues](https://github.com/docs-plus/docs.plus/issues) for bug reports
- 🔒 **Security**: See [SECURITY.md](SECURITY.md) for reporting vulnerabilities
- 📧 **Email**: [contact@newspeak.house](mailto:contact@newspeak.house)

Ask in Discord before you start a large change. A maintainer can tell you early whether the idea fits.

## 🙏 Thank You

Your contributions make docs.plus better for everyone. Thank you for taking the time to contribute! ❤️
