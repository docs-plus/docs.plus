<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/pad-url` are documented here.

This package is private and ships inside docs.plus, so each heading names the docs.plus release that carried the change. The `version` in its `package.json` is not a release line. Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

## [2.3.0] — 2026-11-09

### Added

- First version. The package holds the pure pad link rules in `padUrlCore` (`format`, `plan`,
  `parse`, `place`, `termPattern`), their types, and the one reserved-slug list
  (`isReservedSlug`). It is raw TypeScript, like `email-templates`, and its tests run under
  `bun test` ([#646](https://github.com/docs-plus/docs.plus/issues/646),
  [#648](https://github.com/docs-plus/docs.plus/issues/648)).
- The webapp and the hocuspocus server both build pad links from it, so they give the same
  answer. MCP `create_document` reads its reserved-slug list in place of a hand-kept copy
  ([#648](https://github.com/docs-plus/docs.plus/issues/648)).

### Internal

- The package has a `typecheck` script, so the root `bun run typecheck` gate checks it
  ([#658](https://github.com/docs-plus/docs.plus/issues/658)).
