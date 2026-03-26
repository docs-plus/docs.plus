# Brainstorm: Extract OptimizedPlaceholder to Standalone Extension Package

**Date:** 2026-03-26
**Status:** completed

## What We're Building

Extract `OptimizedPlaceholder` from `packages/webapp/src/components/TipTap/plugins/optimizedPlaceholderPlugin.ts` into a standalone monorepo package (`packages/extension-placeholder/`), following the established pattern of the four existing `@docs.plus/extension-*` packages.

## Why This Approach

- The extension is already self-contained with a clean public interface (`OptimizedPlaceholderOptions`)
- Zero webapp-specific dependencies — only `@tiptap/core` and `@tiptap/pm`
- Consistent with existing architecture: `extension-hyperlink`, `extension-hypermultimedia`, `extension-indent`, `extension-inline-code`
- Reusable across other TipTap consumers (e.g., MessageComposer, TinyDocy)

## Key Decisions

- **Follow existing pattern exactly:** tsup, dual ESM/CJS, barrel export, `@tiptap/core` + `@tiptap/pm` as peerDeps
- **No brainstorming needed:** Pattern is well-established with 4 prior packages
- **Package name:** `@docs.plus/extension-placeholder`

## Open Questions

None — all resolved by existing conventions.
