<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/release-tooling` are documented here.

This package is private and ships inside docs.plus, so each heading names the docs.plus release that carried the change. The `version` in its `package.json` is not a release line. Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

## [2.0.0] — 2026-08-26

### Added

- Two shared bin commands for the publishable extensions. `release-prepack` copies the root
  `LICENSE` into the package tarball. `release-preflight` runs before each publish. It fails when
  the publish does not run under Bun, or when a built bundle still holds a `catalog:` reference. It
  also fails when a file named in the package `exports` map is missing from `dist`.
- Each extension calls them from `prepack` and `prepublishOnly`, so no package keeps its own copy
  of these scripts.
