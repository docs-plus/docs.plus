<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/eslint-config` are documented here.

This package is private and ships inside docs.plus, so each heading names the docs.plus release that carried the change. The `version` in its `package.json` is not a release line. Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

### Fixed

- The base config ignores `.superpowers/**`. That folder holds local agent plan snapshots. Git
  ignores it, but ESLint does not read `.gitignore`, so the pre-push lint gate refused the push.

## [2.2.0] — 2026-10-22

### Fixed

- The base config ignores `.claude/workflows/**`. A Claude Code workflow script is a function body
  that its runtime wraps. Its top-level `return` was a parse error to ESLint, so the pre-push lint
  gate refused the push.

### Documentation

- The README "Current Usage" table lists `document-swarm` on `index.js`, and `floating-popover`,
  `floating-tooltip` and `playground` on `library.js`.

## [2.1.0] — 2026-10-13

### Added

- `next.js` exports `consoleSelector`, its `no-restricted-syntax` console selector. An app config
  that adds its own selectors can keep this one. The webapp config now spreads it.

### Changed

- The base config ignores `Notes/**`, the maintainer notes folder. Git ignores it too, but ESLint
  does not read `.gitignore`.
- `library.js` ignores `examples/**`. Those StackBlitz examples must match the README Quickstart
  word for word.

## [2.0.0] — 2026-08-26

### Added

- **Three ESM flat configs.** `index.js` is the base: TypeScript rules, `simple-import-sort` for
  imports and exports, and `eslint-config-prettier` last. `next.js` adds React, React Hooks and a
  warning on console methods other than `info`, `warn`, `error`, `log` and `debug`. `library.js`
  adds `explicit-module-boundary-types` and allows only `console.warn` and `console.error`.
- **One ignore list in the base.** It covers build output, tests, Cypress and config files. It also
  covers local folders that `.gitignore` hides but ESLint reads: Bun's literal `~` cache, the
  Supabase CLI `.temp` folder and `.claude/worktrees`.
- **A shim in each package.** A package imports a config by relative path. Root, webapp and
  admin-dashboard use `eslint.config.mjs`, and a package with `"type": "module"` uses
  `eslint.config.js`.

### Internal

- Lint runs only from the repo root, as `bun run lint` with `--max-warnings=0`. Packages carry no
  `lint` script.

---

## Pre-`2.0` history

The package started on 2025-10-02 (`c64f3d860`) as a CommonJS flat config, with the same three
files. On 2026-04-19 (`b3146a426`) it became ESM. The base dropped React, and each extension lost
its `createRequire` bridge.
