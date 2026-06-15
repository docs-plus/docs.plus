# CLAUDE.md

Entry point for Claude Code working on **docs.plus**. Read [AGENTS.md](AGENTS.md) first — it is the durable source of truth for this repo's invariants and maintainer preferences. This file is a thin index, not a second copy.

## Read order

1. **[AGENTS.md](AGENTS.md)** — durable rules: package manager, git/commit policy, code quality, testing, skills, UI/theme, monorepo toolchain, publishing, and release flow. Treat it as memory: do not deviate without an explicit maintainer instruction.
2. **Package-local `AGENTS.md`** when working inside a package (e.g. [extensions/extension-hyperlink/AGENTS.md](extensions/extension-hyperlink/AGENTS.md)). Read in addition to the root file.
3. The relevant `.cursor/rules/*.mdc` for the file you are editing (see index below).

If guidance overlaps, project policy in `AGENTS.md` and `.cursor/docs/` wins; `.mdc` files are reference material for authoring.

## Hard invariants (do not violate)

These are the rules that bite hardest if missed. Full context in [AGENTS.md](AGENTS.md).

- **Bun only.** Never `npm`, `yarn`, `pnpm`, `npx` — including the install commands in published extension READMEs/CHANGELOGs (`bun add …@next` during soak, never `npm install`). Lockfile is `bun.lock`.
- **No commits unless asked.** No `git add`, `git commit`, `git push`, `git stash`, or `--amend` inside plan execution. End multi-task plans at a "Review checkpoint".
- **Stay in the current worktree.** Do not switch execution to another path or parallel checkout.
- **Tests are opt-in, not default.** Do not add tests unless asked, pinning a real regression, or covering dense branching logic. Prefer Cypress E2E over unit. Never write the banned shapes listed in [AGENTS.md](AGENTS.md) §Testing And Verification.
- **Prose routes through the `tech-writer` skill.** README, CHANGELOG, reports, post-mortems, PR descriptions, JSDoc.
- **JSDoc/comments ≤ 4 lines, why-not-what.** No section banners. No restating signatures.

## Cursor rules — `.cursor/rules/`

Reference material that auto-attaches in Cursor. In Claude Code, open the relevant file when the matching surface is touched.

- [daisyui.mdc](.cursor/rules/daisyui.mdc) — daisyUI 5 + Tailwind reference for UI work.
- [react-floating-ui.mdc](.cursor/rules/react-floating-ui.mdc) — React 19.2 + `@floating-ui/react` 0.27 conventions and pitfalls.
- [supabase.mdc](.cursor/rules/supabase.mdc) — SQL authoring, Supabase migrations, generated files, RLS. Triggers on `**/*.sql`, `packages/supabase/**`, `apps/webapp/src/types/supabase.ts`.
- [tiptap.mdc](.cursor/rules/tiptap.mdc) — Tiptap/ProseMirror reference workflow for editor code under `apps/webapp/src/components/TipTap/**`, `chatroom/**`, `extension-*/**`, `hocuspocus.server/src/**`.
- [scripts-naming.mdc](.cursor/rules/scripts-naming.mdc) — script and Make-target naming. Triggers on `package.json`, `Makefile`, `.github/workflows/**`, `scripts/**`.

## Long-form policy — `.cursor/docs/`

- [scripts-naming-convention.md](.cursor/docs/scripts-naming-convention.md) — timeless source of truth that `scripts-naming.mdc` points at.

## Skills — project-local

### `.cursor/skills/` — docs.plus-specific

Open the `SKILL.md` when its trigger matches.

- [code-janitor](.cursor/skills/code-janitor/SKILL.md) — autonomous cleanup pipeline (Simplification → Abstraction → Readability → Documentation → Production-Readiness). Use for "clean up", "polish", "tidy", "production ready".
- [commit-review](.cursor/skills/commit-review/SKILL.md) — group changes and draft Conventional Commit messages. Use for "review changes", "write commits".
- [tech-writer](.cursor/skills/tech-writer/SKILL.md) — senior-tech-writer voice for **all** prose: README, CHANGELOG, reports, post-mortems, PR descriptions, JSDoc prose. Other skills delegate prose work here.
- [tiptap](.cursor/skills/tiptap/SKILL.md) — Tiptap integration helper (extensions, collaboration, comments, AI, document conversion).

### `.agents/skills/` — [mattpocock/skills](https://github.com/mattpocock/skills)

Installed via `bunx skills@latest add mattpocock/skills`; lockfile: `skills-lock.json`. Run [setup-matt-pocock-skills](.agents/skills/setup-matt-pocock-skills/SKILL.md) once to wire issue tracker, triage labels, and domain docs.

Engineering highlights:

- [improve-codebase-architecture](.agents/skills/improve-codebase-architecture/SKILL.md) — deepen shallow modules, propose refactor RFCs.
- [diagnose](.agents/skills/diagnose/SKILL.md) — reproduce → minimise → hypothesise → instrument → fix.
- [tdd](.agents/skills/tdd/SKILL.md) — red-green-refactor test-first development.
- [grill-me](.agents/skills/grill-me/SKILL.md) / [grill-with-docs](.agents/skills/grill-with-docs/SKILL.md) — align on plans before building.
- [triage](.agents/skills/triage/SKILL.md), [to-issues](.agents/skills/to-issues/SKILL.md), [to-prd](.agents/skills/to-prd/SKILL.md) — issue workflow.

Skills never create branches or worktrees and never commit — they operate in the current directory and branch.

## Workspace shape

- Bun monorepo, workspaces = `apps/*` (webapp, hocuspocus.server, admin-dashboard), `extensions/*` (the five `@docs.plus/extension-*`), `packages/*` (floating-popover, eslint-config, release-tooling, supabase, email-templates). Engines: Node ≥ 24.11.0, Bun ≥ 1.3.7.
- Webapp: [@docs.plus/webapp](apps/webapp/) (Next.js Pages Router).
- Realtime backend: [@docs.plus/hocuspocus.server](apps/hocuspocus.server/).
- Admin: [@docs.plus/admin-dashboard](apps/admin-dashboard/).
- Editor: [apps/webapp/src/components/TipTap/](apps/webapp/src/components/TipTap/).
- Publishable extensions: `extensions/extension-*` (use [@docs.plus/release-tooling](packages/release-tooling/) for `prepack` / `prepublishOnly`).

Run scripts from the repo root with workspace filters, e.g. `bun run --filter @docs.plus/webapp dev`.
