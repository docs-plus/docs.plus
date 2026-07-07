---
name: design-system
description: Apply the docs.plus design system (tokens, themes, elevation species, component state recipes) to any UI work. Use when the user mentions theme, colors, dark/light mode, borders, shadows, radius, styling, polish, cohesion, a new component/surface, or any visual change in apps/webapp.
---

# Design System

Working protocol for visual changes in `apps/webapp`. The source of truth is
[.cursor/docs/design-system.md](../../docs/design-system.md) — tokens, themes, elevation species,
state language, and the per-component catalog. `AGENTS.md` owns behavioral invariants
(§UI And Theme, §Pad Workspace Surfaces, §Floating Surfaces And Modal Scrims, §Motion System).

## Protocol

1. **Read the relevant doc sections first**: tokens/themes for color work; elevation species for any
   new or moved surface; the component's catalog row before editing its frame or states.
2. **Classify before styling.** Every surface is one species: docked (L0), anchored (L1), modal (L2),
   tooltip, card, control, sheet — reuse its canonical export or recipe verbatim. If no species
   fits, extend the doc's elevation table first, then implement.
3. **Change color at the token layer.** New colors/effects become `:root` vars (+ both dark
   overrides) in `globals.scss`, exposed via `@theme` aliases when Tailwind utilities are needed.
   Components never carry hex or raw palette classes (brand allowlist and media-anchored
   black/white overlays excepted — see the doc's Color policy).
4. **States are recipes, not improvisation**: hover `base-200`, active `is-active`
   (primary-10% + primary ink), context-menu-active primary-15%/8%, focus
   `focus-visible:ring-2 ring-primary`, unread error badge, disabled `/40` ink. Cover both layers —
   desktop and mobile variants of the same component share tokens, not necessarily geometry.
5. **Keep lockstep surfaces in sync** in the same change: skeleton mirrors (SlugPageLoader /
   ChatroomComposerSkeleton copy the real frame classes verbatim), `_document.tsx` theme-color meta,
   third-party CSS-var themings (`em-emoji-picker`, `.documentKeywordInput`), and the JS motion
   mirror (`utils/motion.ts`).
6. **Verify in the browser** — light + dark (+ dark-HC for pad/TOC), desktop ≥1280px and mobile —
   never typecheck alone. Confirm the webapp dev port before driving it (not always 3000).
7. **Close the loop**: update the doc's affected rows (and `AGENTS.md` when doctrine moved) in the
   same change; after substantive design-system work, run the memory updater.

## Hard guardrails

- No new shadow/radius values; no shadows on docked light surfaces; scrims are black tokens only.
- No `*Classes.ts`/`*Styles.ts` string modules; no second floating-surface language.
- No live regions inside `.ProseMirror`; overlay species and motion tiers come from AGENTS.md.
- Never `next build` against a live dev server (shared `.next`) — `tsc --noEmit` + the running app.
