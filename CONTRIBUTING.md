# Contributing to docs.plus

Thank you for your interest in contributing to docs.plus! 🎉 This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Project Structure](#project-structure)
- [Getting Help](#getting-help)

## 🤝 Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors. Be kind, constructive, and professional in all interactions.

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

- 🐳 **Docker** & **Docker Compose** v2+ - [Install](https://docs.docker.com/get-docker/)
- 🚀 **Bun** >=1.3.7 - [Install](https://bun.sh/docs/installation)
- 📦 **Node.js** >=24.11.0 (for some tooling)
- 🗄️ **Supabase CLI** - [Install](https://supabase.com/docs/guides/cli/installation)
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

### 1. Install Dependencies

```bash
bun install
```

### 1.5 Run Doctor (Optional)

Check your environment is correctly set up:

```bash
bun run doctor
```

### 2. Environment Configuration

```bash
cp .env.example .env.development
```

Update `.env.development` with your local configuration. See `.env.example` for all available variables.

### 3. Initialize Supabase

```bash
make supabase-start
```

Then follow the Supabase setup instructions in the [README.md](README.md#3-initialize-supabase).

### 4. Start Development Environment

```bash
make up-dev
```

This starts all services:

- 🌐 Webapp: http://localhost:3000
- 🔌 REST API: http://localhost:4000
- ⚡ WebSocket: ws://localhost:4001
- 👷 Worker: http://localhost:4002

## ✏️ Making Changes

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

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(webapp): add dark mode toggle
fix(api): resolve memory leak in document sync
docs(readme): update installation instructions
refactor(editor): simplify toolbar component
```

## 🎨 Code Style

### Formatting

We use **Prettier** for code formatting. Format your code before committing:

```bash
bun run format
```

Or check formatting:

```bash
bun run format:check
```

### Linting

We use **ESLint** for code quality. Fix linting issues:

```bash
bun run lint:fix
```

### Git Hooks (Husky)

We use **Husky** to enforce local quality gates before code reaches remote branches.

- `.husky/*` contains lightweight wrapper scripts.
- `scripts/hooks/*.sh` contains the actual hook logic.
- Active hooks:
  - `pre-commit`: runs `bun run lint:staged` (staged-file lint/format checks)
  - `commit-msg`: validates commit message format
  - `pre-push`: runs selective build checks and always runs `bun run check:full` for **every push** (lint + format + types + Stylelint)
  - `post-merge`: runs `bun install` when `package.json` or `bun.lock` changes

You can trigger hooks manually:

```bash
# pre-commit (staged file checks)
sh .husky/pre-commit

# commit message validation
echo "feat(webapp): verify hook docs" > /tmp/commit-msg.txt
sh .husky/commit-msg /tmp/commit-msg.txt

# pre-push simulation (no real push)
printf 'refs/heads/feature/demo 0000000000000000000000000000000000000000 refs/heads/feature/demo 0000000000000000000000000000000000000000\n' | \
  sh .husky/pre-push origin https://github.com/docs-plus/docs.plus.git
```

### TypeScript

- Use TypeScript for all new code
- Avoid `any` types - use proper types or `unknown`
- Enable strict mode in your IDE
- Run type checking: `bun run check:types` or `bun run build` (will fail on type errors)
- Tooling policy and CI parity: [docs/engineering/toolchain.md](./docs/engineering/toolchain.md)

### Quality commands (summary)

| Command                | Use case                                  |
| ---------------------- | ----------------------------------------- |
| `bun run check`        | Lint + Prettier check + typecheck         |
| `bun run check:full`   | Above + Stylelint (matches pre-push gate) |
| `bun run check:static` | Lint + Prettier + Stylelint (no `tsc`)    |

## 🧪 Testing

### Running All Tests

Run unit + E2E tests together with a single command:

```bash
bun run test:all          # unit + E2E, report saved to Notes/
bun run test:unit         # unit only
bun run test:e2e          # E2E only (4 parallel workers by default)
```

### Unit Tests

Run unit tests with Jest:

```bash
cd packages/webapp
bun run test
```

### E2E Tests

Cypress E2E tests run in **parallel** across multiple workers using [cypress-split](https://github.com/bahmutov/cypress-split). This splits spec files across N Cypress instances for faster feedback.

```bash
# Interactive mode (single instance)
bun run cypress:open

# Headless — parallel (default 4 workers)
bun run test:e2e

# Explicit worker counts
bun run test:e2e:2        # 2 parallel workers
bun run test:e2e:4        # 4 parallel workers
bun run test:e2e:8        # 8 parallel workers

# Ad-hoc worker count
CYPRESS_PARALLEL=6 bun run test:e2e
```

> **Prerequisites:** The dev server must be running (`make dev-local`) before running E2E tests. By default tests hit `http://localhost:3001` — override with `BASE_URL`.

**Choosing a worker count:**

| Workers | RAM needed | Best for                               |
| ------- | ---------- | -------------------------------------- |
| 2       | ~1 GB      | Low-resource machines, CI containers   |
| 4       | ~2 GB      | Default — good balance on most laptops |
| 8       | ~4 GB      | 16 GB+ RAM, 8+ cores                   |

After a run you get an aggregated results dashboard with per-worker stats, timing breakdown, and parallelism factor. Reports are saved to `Notes/test-results-*.txt`.

### Test Coverage

Aim for good test coverage, especially for:

- Critical business logic
- API endpoints
- Complex components
- Utility functions

### Writing Tests

- Write tests alongside your code
- Test behavior, not implementation
- Use descriptive test names
- Keep tests simple and focused

## 📤 Submitting Changes

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

3. **Run checks** (lint + format + types):

   ```bash
   bun run check
   ```

   This is also enforced automatically by `pre-push` for every `git push`.

   Or individually:

   ```bash
   bun run lint
   bun run format:check
   bun run typecheck:webapp
   bun run typecheck:admin
   bun run typecheck:backend
   ```

4. **Test locally**:
   - Start the development environment
   - Test your changes manually
   - Verify no regressions

### Creating a Pull Request

1. **Push your branch**:

   ```bash
   git push origin your-branch
   ```

2. **Create a PR** on GitHub:
   - Use a clear, descriptive title
   - Fill out the PR template (if available)
   - Reference any related issues
   - Add screenshots/GIFs for UI changes

3. **PR Checklist**:
   - [ ] Code follows style guidelines
   - [ ] Tests pass locally
   - [ ] Documentation updated (if needed)
   - [ ] No console errors/warnings
   - [ ] Changes are backward compatible (if applicable)

### PR Review Process

- Maintainers will review your PR
- Address feedback promptly
- Keep PRs focused and reasonably sized
- Be open to suggestions and improvements

## 📁 Project Structure

```
docs.plus/
├── packages/
│   ├── webapp/              # 🌐 Next.js frontend
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── api/         # API clients
│   │   │   ├── hooks/       # React hooks
│   │   │   ├── stores/      # State management
│   │   │   └── utils/       # Utility functions
│   │   └── cypress/         # E2E tests
│   ├── hocuspocus.server/   # ⚡ REST API, WebSocket, Workers
│   │   ├── src/
│   │   │   ├── api/         # REST API routes & controllers
│   │   │   ├── lib/         # Shared libraries (email, push, etc.)
│   │   │   ├── middleware/  # Hono middleware
│   │   │   └── config/      # Configuration & env schemas
│   │   └── prisma/          # Prisma schema & migrations
│   ├── admin-dashboard/     # 🛠️ Admin interface (Next.js)
│   ├── supabase/            # 🗄️ Supabase configuration
│   │   └── scripts/         # SQL migration scripts
│   └── extension-*/         # 🔌 TipTap extensions
├── .github/workflows/       # 🔄 CI/CD pipelines
├── docker-compose.dev.yml   # 🐳 Development setup
├── docker-compose.prod.yml  # 🚀 Production setup
└── Makefile                 # 🛠️ Build commands
```

### Docker / production images

When adding or changing a **Dockerfile** (e.g. for a new service or image):

- **Monorepo, no flatten:** Keep workspace layout (`packages/<name>`) in the image; do not copy a single package to `/app` and discard the rest.
- **One `bun install` per stage;** do not copy `node_modules` between stages (Bun symlinks break).
- **Minimal copy set:** Root workspace files + full copies only of packages the service needs; use stub `package.json` for other workspaces so the lockfile resolves.

Full conventions, copy-set rules, stages, entrypoints, and checklist: **[CI/CD Improvement Roadmap — § 11. Dockerfile & Monorepo Conventions (Team Guide)](Notes/CI_CD_Improvement_Roadmap.md#11-dockerfile--monorepo-conventions-team-guide).**

## 🎯 Areas for Contribution

We welcome contributions in all areas:

- 🐛 **Bug Fixes**: Fix issues reported in GitHub Issues
- ✨ **Features**: Implement new features (check Issues for ideas)
- 📚 **Documentation**: Improve docs, add examples, fix typos
- 🧪 **Tests**: Add tests, improve coverage
- 🎨 **UI/UX**: Improve design, accessibility, user experience
- ⚡ **Performance**: Optimize code, reduce bundle size
- 🔒 **Security**: Report or fix security issues

## 💡 Getting Help

- 💬 **Discord**: [Join our server](https://discord.com/invite/25JPG38J59) for real-time help
- 🐛 **Issues**: [GitHub Issues](https://github.com/docs-plus/docs.plus/issues) for bug reports
- 🔒 **Security**: See [SECURITY.md](SECURITY.md) for reporting vulnerabilities
- 📧 **Email**: [contact@newspeak.house](mailto:contact@newspeak.house)

## 🙏 Thank You!

Your contributions make docs.plus better for everyone. Thank you for taking the time to contribute! ❤️

---

**Questions?** Feel free to ask in Discord or open an issue on GitHub.
