# CLAUDE.md

Entry point for Claude Code working on **docs.plus**. Read [AGENTS.md](AGENTS.md) first — it is the durable source of truth for this repo's invariants and maintainer preferences. This file is a thin index, not a second copy.

## Read order

1. **[AGENTS.md](AGENTS.md)** — durable cross-cutting rules: package manager, git/commit policy, code quality, testing, skills, UI/theme, monorepo toolchain. Treat it as memory: do not deviate without an explicit maintainer instruction. Its §Filed by directory map lists every directory-scoped section and the file that now holds it.
2. **The per-directory `CLAUDE.md`** for the area you are touching — Claude Code loads it automatically when you work under that path:
   - [apps/webapp/CLAUDE.md](apps/webapp/CLAUDE.md) — UI systems and document features
   - [apps/webapp/src/components/TipTap/CLAUDE.md](apps/webapp/src/components/TipTap/CLAUDE.md) — editor architecture
   - [apps/webapp/src/components/chatroom/CLAUDE.md](apps/webapp/src/components/chatroom/CLAUDE.md) — chatroom and messaging
   - [apps/hocuspocus.server/CLAUDE.md](apps/hocuspocus.server/CLAUDE.md) — persistence, HTTP modules, production
   - [apps/admin-dashboard/CLAUDE.md](apps/admin-dashboard/CLAUDE.md) — admin data path
   - [packages/supabase/CLAUDE.md](packages/supabase/CLAUDE.md) — SQL, migrations, RLS, storage
   - [extensions/CLAUDE.md](extensions/CLAUDE.md) — extension workflow and per-package rules
3. **Package-local `AGENTS.md`** when working inside a package (e.g. [extensions/extension-hyperlink/AGENTS.md](extensions/extension-hyperlink/AGENTS.md)). Read in addition to the above.
4. The relevant `.cursor/rules/*.mdc` for the file you are editing (see index below).

Durable memory is at `.agents/memory/` (gitignored symlink to the Claude Code store, shared with Cursor); `.agents/memory/MEMORY.md` is the index. **Cursor does not read `CLAUDE.md`** — it gets the same rules through [.cursor/rules/agent-rules-and-memory.mdc](.cursor/rules/agent-rules-and-memory.mdc). Keep that map current when a rule file moves. Local working notes live in `Notes/` (gitignored). Current reports sit in `Notes/local-docs/`. Start at that folder's `INDEX.md`. Open it for inject-content, Last left, occupancy, restore, REST gaps, scale, auth, composer, extension launch, TOC rail, or chat sash.

If guidance overlaps, project policy in `AGENTS.md` and `.cursor/docs/` wins; `.mdc` files are reference material for authoring.

## Hard invariants (do not violate)

These rules cause the most damage when an agent misses them. Full context in [AGENTS.md](AGENTS.md).

- **Bun only for repo work.** Never run `npm`, `yarn`, `pnpm`, or `npx` in this monorepo. One exception: install lines for extension users in public docs lead with `npm install <pkg>`, then name pnpm, Yarn, and Bun (maintainer ruling, 2026-09-22). No `@next` soak lines. See the [release-extensions](.cursor/skills/release-extensions/SKILL.md) skill §Extension Package Contract. Lockfile is `bun.lock`.
- **No commits unless asked.** No `git add`, `git commit`, `git push`, `git stash`, or `--amend` inside plan execution. End multi-task plans at a "Review checkpoint".
- **Stay in the current worktree.** Do not switch execution to another path or parallel checkout.
- **Never hand-edit generated files:** `apps/webapp/src/types/supabase.ts` (Supabase CLI output) and `packages/supabase/seed.sql`. After any SQL change run `bun run --filter @docs.plus/supabase_back types` and include the regenerated file in the same change — full rules in [packages/supabase/CLAUDE.md](packages/supabase/CLAUDE.md).
- **Tests are opt-in, not default.** Do not add tests unless asked, pinning a real regression, or covering dense branching logic. Prefer Cypress E2E over unit. Never write the banned shapes listed in [AGENTS.md](AGENTS.md) §Test Policy.
- **Simplified English is mandatory.** Short sentences; one name per thing. It binds chat replies, reports, code comments, commit bodies, and every document, for every agent and subagent. The obligation and its subagent-dispatch clause live in [AGENTS.md](AGENTS.md) §Simplified English Mandate. The rules and the exempt surfaces live in [tech-writer](.cursor/skills/tech-writer/SKILL.md#simplified-english-house-standard).
- **Prose routes through the [`tech-writer`](.cursor/skills/tech-writer/SKILL.md) skill,** including its [Simplified English](.cursor/skills/tech-writer/SKILL.md#simplified-english-house-standard) standard and the surfaces it exempts. README, CHANGELOG, reports, post-mortems, PR descriptions, JSDoc.
- **JSDoc/comments ≤ 4 lines, why-not-what.** No section banners. No restating signatures.
- **The design system is locked and mandatory.** Build every UI change from [.cursor/docs/design-system.md](.cursor/docs/design-system.md), including §House language (direction C), approved on 2026-09-29. Never add or change a token, species, size, radius, shadow, ink step or house-language rule unless the maintainer asked for that exact change. A PreToolUse hook (`scripts/hooks/design-system-lock.ts`) asks the maintainer before any edit to the locked files; never bypass it through a shell command, and never loosen the hook, `.claude/settings.json` or `.github/CODEOWNERS`. Full rule: design-system.md §Change protocol (locked).

### Settled — do not re-propose

Each was decided, and in most cases built and reverted. If you want to change one, say which decision you are overturning and bring new evidence. Do not re-derive it from first principles and propose it as new.

- **AGENTS.md structure.** Split into per-directory `CLAUDE.md` files: tried 2026-07-27, reverted; re-applied and kept 2026-08-03. See AGENTS.md §Filed by directory.
- **TOC channel-map rework.** Built, then reverted at maintainer request by commit `9c535100c` on 2026-07-07 (do not run that hash as a command — reverting the revert re-applies the rework). The TOC is deliberately on the older behaviour. Do not re-propose the data-level type ladder, chat-open accent bar, or scroll-spy wash.
- **Desktop TOC tick rail.** Session-only 32px rail in the pad row so docked chat can go full width. Persist last committed wide width only (`docsy:toc-width`, greater than 240). Stored 240 or less is missing and opens at 320. Do not persist 32 or 240. Do not export `TocTickRail` from `toc/index.ts`. Do not put the rail beside the wide TOC (that kills full-width chat). Do not inset rail height for the sash. Do not add `SideContinuum`. Do not hide the preview clone behind a skeleton. Do not drop media because it is taller than the card. Do not drop a whole next heading rank if that leaves a short centered stack. Do not always-center the spy tick. Do not lock a short tick stack to the window mid-line; center it in the live rail. Rail spy tick is `bg-primary`; wide TOC spy stays `menu-focus` / `base-300`. Preview is an L1 clone card, not the house Tooltip. See [apps/webapp/CLAUDE.md](apps/webapp/CLAUDE.md) §TOC And Heading Actions and `CONTEXT.md` §Pad outline.
- **Collab storage design.** Delta storage, Yjs V2 encoding, content-addressed rows, time partitioning, and blobs-to-object-storage were each measured against the real corpus and rejected, 2026-07-27. New numbers required. See [apps/hocuspocus.server/CLAUDE.md](apps/hocuspocus.server/CLAUDE.md).
- **Dark mode mechanism.** `color-scheme` + `light-dark()` + semantic tokens, settled 2026-07-09. Never reintroduce a theming `data-mode` attribute or a `dark:`-enumerating `@custom-variant` — both were built and deleted. The unrelated `data-mode` on chat message cards is live and correct.
- **TOC presence overhang.** Rendering presence beyond the TOC column edge was evaluated and rejected; the `overflow: visible` hack breaks column scrolling. See [apps/webapp/CLAUDE.md](apps/webapp/CLAUDE.md) §TOC And Heading Actions.
- **The `mattpocock-skills` marketplace plugin.** Installed 2026-08-07, then disabled the same day, because it exposes 25 skills, and 21 of them already exist in `.agents/skills`. So every one of those names resolved twice, with different instructions. The plugin also only works in Claude Code. In contrast, `.agents/skills` is tracked in git and symlinked into `.cursor/skills`. That is the only reason these skills exist in Cursor at all. Refresh the tracked copies instead — see §Skills — project-local. Do not re-enable the plugin; do not add it to the committed `.claude/settings.json`.
- **Title write.** One client module `apps/webapp/src/utils/titleWrite.ts`. Adapters keep their own UI work. The open-pad relay (metadata store plus the `docTitle` stateless) runs once in `useUpdateDocMetadata`'s hook-level `onSuccess`, so a queued offline rename still relays after its dialog closes (ruled 2026-09-23). `docTitle` carries no text. The provider's `onStateless` routes it to `onDocTitleStateless`, which refetches over REST (#406). Do not merge Title write with Access mutation. Do not invent a workspace package for the tag strip. Do not fold first-heading admission into this module. A signed-in rename posts `title_changed`. History paints the snapshot username. Chat paints the live username. The relay runs only when the renamed id is the open pad. Open document and first-edit ownership live in `CONTEXT.md` §Document access. See `CONTEXT.md` §Pad outline.
- **House envelope home.** `apps/hocuspocus.server/src/http/envelope.ts` owns `ok` / `fail` / `houseEnvelopeHook`. Do not force the hook onto link-metadata. See [apps/hocuspocus.server/CLAUDE.md](apps/hocuspocus.server/CLAUDE.md) §HTTP Modules.
- **Collab session helpers.** Auth and disconnect predicates live in `apps/webapp/src/hooks/collabSession.ts`. Do not rewrite `HocuspocusProvider` construction. Do not re-export those helpers from `@utils`.
- **Report route storage.** The Report action posts to the published contact address in `LEGAL_CONTACT_EMAIL` and keeps nothing. That was the deliberate scope, taken 2026-09-06 with the launch-legal review. Build storage or triage tooling only when real report volume shows it is needed, and bring the count rather than a design. One canonical home, `apps/webapp/src/utils/reportContent.ts` — do not add a second report path. Document report is a Settings row for signed-in users on a pad (`/[...slugs]`). Hide it on Home. Do not restore a pad-title control. The chat message Report row stays at `display: false`. Contract in [apps/webapp/CLAUDE.md](apps/webapp/CLAUDE.md) §Report Route.
- **Passkeys are off.** Removed 2026-09-07. No sign-in button, no Conditional UI, no Settings card, no `auth.experimental.passkey`. Local `[auth.passkey] enabled = false`. Sign-in is Google or an email link. Do not rebuild the client. A production dashboard toggle that is still on does not restore the UI.
- **Next product APIs.** Health stays on Next. Validate lives on the email router as `POST /api/email/validate`. Status does not become a Hono route. Confirm is deleted and stays deleted. Leave `apps/webapp/src/utils/supabase/api.ts`. Do not edit `src/proxy.ts`, Next health rewrites, Traefik, or Docker HEALTHCHECK. Names live in `CONTEXT.md` §Product HTTP.
- **History restore is signed-in only.** Visitors may read history. They never see Restore. Do not replace the hidden control with a sign-in toast on the same button. Server refusal is `unauthorized` / `read-only`. See webapp §Document Version History and `CONTEXT.md` §Document access.
- **Chat send animation.** An iMessage-style send flight was built and reverted at maintainer request on 2026-09-21, and #263 closed with motion rejected. Own sends show only the static pending clock. Do not rebuild any send motion unless the maintainer asks. See [apps/webapp/src/components/chatroom/CLAUDE.md](apps/webapp/src/components/chatroom/CLAUDE.md).
- **Phone mic is hold-only.** A tap shows a hint and never sends; release sends the note, alone, once its upload is ready. Maintainer ruling, 2026-09-22. Do not add tap-to-record on a phone. Rules and reasons in [apps/webapp/src/components/chatroom/CLAUDE.md](apps/webapp/src/components/chatroom/CLAUDE.md).

## Cursor rules — `.cursor/rules/`

Reference material that auto-attaches in Cursor. In Claude Code, open the relevant file when you touch the matching surface.

- [design-system.mdc](.cursor/rules/design-system.mdc) — design-system pointer + cardinal rules for all webapp UI work; source of truth is [.cursor/docs/design-system.md](.cursor/docs/design-system.md).
- [react-floating-ui.mdc](.cursor/rules/react-floating-ui.mdc) — React 19.2 + `@floating-ui/react` 0.27 conventions and pitfalls.
- [supabase.mdc](.cursor/rules/supabase.mdc) — SQL authoring, Supabase migrations, generated files, RLS. Triggers on `**/*.sql`, `packages/supabase/**`, `apps/webapp/src/types/supabase.ts`.
- [tiptap.mdc](.cursor/rules/tiptap.mdc) — Tiptap/ProseMirror reference workflow for editor code under `apps/webapp/src/components/TipTap/**`, `chatroom/**`, `extension-*/**`, `hocuspocus.server/src/**`.
- [scripts-naming.mdc](.cursor/rules/scripts-naming.mdc) — script and Make-target naming. Triggers on `package.json`, `Makefile`, `.github/workflows/**`, `scripts/**`.

## Long-form policy — `.cursor/docs/`

- [design-system.md](.cursor/docs/design-system.md) — source of truth for the webapp visual language: daisyUI/Tailwind tokens, themes, elevation species, state recipes, and the component catalog. `design-system.mdc` and the `design-system` skill point at it.
- [scripts-naming-convention.md](.cursor/docs/scripts-naming-convention.md) — timeless source of truth that `scripts-naming.mdc` points at.

## Skills — project-local

Every skill's name and trigger description is already loaded in each session — browse them there, and open a `SKILL.md` when its trigger matches. Two sources:

- **`.cursor/skills/`** — docs.plus-specific skills, symlinked as `.claude/skills` so Claude Code loads them.
- **`.agents/skills/`** — [mattpocock/skills](https://github.com/mattpocock/skills), installed via `bunx skills@latest add mattpocock/skills`; lockfile `skills-lock.json`. Run [setup-matt-pocock-skills](.agents/skills/setup-matt-pocock-skills/SKILL.md) once to wire issue tracker, triage labels, and domain docs.

Refresh the upstream set with `bunx skills@latest update -p -y` — it rewrites the tracked files in place through `skills-lock.json`, so the diff is reviewable. This is the only supported way to take new upstream content. Installing the same skills as a Claude Code plugin duplicates every name and loses Cursor. That is why the plugin route is settled above. The CLI prints `npx` in its hints; ignore it, Bun only. The CLI cannot update `tiptap`. That skill predates `skillPath` tracking, and it is a vendored [ueberdosis](https://github.com/ueberdosis/tiptap) copy living as a real directory in `.cursor/skills/`. Refresh that one deliberately, never as part of a sweep.

Skills never create branches or worktrees and never commit — they operate in the current directory and branch.
