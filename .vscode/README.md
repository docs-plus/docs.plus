# VS Code Workspace Configuration

This directory contains shared VS Code settings to ensure all team members have a consistent development experience.

## 📦 Files

- **`settings.json`** - Workspace settings (formatting, linting, etc.)
- **`extensions.json`** - Recommended extensions
- **`tasks.json`** - Common tasks (build, lint, format)
- **`launch.json`** - Debug configurations

## 🚀 Getting Started

### 1. Install Recommended Extensions

When you open this workspace, VS Code will prompt you to install recommended extensions. Click "Install All" or:

```
CMD/CTRL + Shift + P → "Extensions: Show Recommended Extensions"
```

### 2. Required Extensions

**Must Have:**

- ESLint
- Prettier
- Prisma
- Tailwind CSS IntelliSense

**Highly Recommended:**

- GitLens
- Error Lens
- Conventional Commits
- Bun for VS Code

### 3. Settings Applied

All developers get:

- ✅ Format on save (Prettier)
- ✅ Lint on save (ESLint)
- ✅ Consistent tab size (2 spaces)
- ✅ LF line endings
- ✅ Trim trailing whitespace
- ✅ TypeScript support
- ✅ Tailwind CSS IntelliSense
- ✅ Git integration

## 🛠️ Available Tasks

Access via: `CMD/CTRL + Shift + P → "Tasks: Run Task"`

- **Install Dependencies** - `bun install`
- **Lint** - Check for issues
- **Lint & Fix** - Auto-fix issues
- **Format** - Format all files
- **Build All** - Build entire monorepo
- **Start Dev (All Services)** - `make local`
- **Start Webapp** - Next.js dev server
- **Prisma Generate** - Generate Prisma client
- **Update Packages** - Update all dependencies
- **Reinstall All** - Clean reinstall

## 🐛 Debug Configurations

Access via: `F5` or Debug panel

**Single Service:**

- Next.js: Debug Server
- Next.js: Debug Client
- Hocuspocus: Debug REST API
- Hocuspocus: Debug WebSocket

**Multi-Service:**

- Full Stack Debug (all services)

## ⚙️ Customization

### Personal Settings

If you need personal settings that differ from the team:

1. **DO NOT** edit `.vscode/settings.json`
2. Use User Settings instead: `CMD/CTRL + ,`
3. Or create `.vscode/settings.local.json` (add to `.gitignore`)

### Team Settings

To propose changes to team settings:

1. Edit `.vscode/settings.json`
2. Create PR
3. Discuss with team

## 🔧 Troubleshooting

### ESLint not working?

1. Reload VS Code: `CMD/CTRL + Shift + P → "Reload Window"`
2. Check output: `Output → ESLint`
3. Ensure flat config: `"eslint.useFlatConfig": true`

### Prettier not formatting?

1. Check default formatter: Right-click file → "Format Document With..." → Choose Prettier
2. Ensure `"prettier.requireConfig": true` is set
3. Check `.prettierrc.json` exists

### Tailwind IntelliSense not working?

1. Reload VS Code
2. Check `tailwind.config.js` exists in webapp
3. Restart Tailwind IntelliSense: `CMD/CTRL + Shift + P → "Tailwind CSS: Restart Tailwind IntelliSense"`

### TypeScript errors?

1. Restart TS Server: `CMD/CTRL + Shift + P → "TypeScript: Restart TS Server"`
2. Ensure correct workspace: Check status bar for TS version
3. Generate Prisma client: `make prisma_generate`

## 📚 Resources

- [VS Code Workspace Settings](https://code.visualstudio.com/docs/getstarted/settings)
- [ESLint Extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier Extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [Bun Documentation](https://bun.sh/docs)

---

**Note:** These settings are version controlled. Any changes affect the entire team.
