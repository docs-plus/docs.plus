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
- 🚀 **Bun** >=1.3.2 - [Install](https://bun.sh/docs/installation)
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

### Pre-commit Hooks

We use **Husky** and **lint-staged** to automatically format and lint code before commits. These hooks run automatically, but you can manually trigger them:

```bash
bun run lint:staged
```

### TypeScript

- Use TypeScript for all new code
- Avoid `any` types - use proper types or `unknown`
- Enable strict mode in your IDE
- Run type checking: `bun run build` (will fail on type errors)

## 🧪 Testing

### Unit Tests

Run unit tests with Jest:

```bash
cd packages/webapp
bun test
```

### E2E Tests

Run Cypress E2E tests:

```bash
# Interactive mode
bun run cypress:open

# Headless mode
bun run cypress:run
```

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

3. **Run tests**:
   ```bash
   bun run lint
   bun run format:check
   bun run build
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
│   │   │   ├── api/         # API routes
│   │   │   ├── lib/         # Shared libraries
│   │   │   └── middleware/  # Middleware
│   │   └── tests/           # Unit & integration tests
│   ├── supabase/            # 🗄️ Database migrations
│   │   └── scripts/         # SQL scripts
│   └── extension-*/         # 🔌 TipTap extensions
├── docker-compose.dev.yml   # 🐳 Development setup
├── docker-compose.prod.yml  # 🚀 Production setup
└── Makefile                 # 🛠️ Build commands
```

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
- 📧 **Email**: [contact@newspeak.house](mailto:contact@newspeak.house)

## 🙏 Thank You!

Your contributions make docs.plus better for everyone. Thank you for taking the time to contribute! ❤️

---

**Questions?** Feel free to ask in Discord or open an issue on GitHub.

