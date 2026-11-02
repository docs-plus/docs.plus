<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/pad-url` are documented here.

This package is private and ships inside docs.plus, so each heading names the docs.plus release that carried the change. The `version` in its `package.json` is not a release line. Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

### Added

- First version. The package holds the pure pad link rules in `padUrlCore` (`format`, `plan`,
  `parse`, `termPattern`), their types, and the one reserved-slug list
  (`isReservedSlug`). It is raw TypeScript, like `email-templates`, and its tests run under
  `bun test` ([#648](https://github.com/docs-plus/docs.plus/issues/648)).
- The webapp and the hocuspocus server both build pad links from it, so they give the same
  answer. MCP `create_document` reads its reserved-slug list in place of a hand-kept copy.
