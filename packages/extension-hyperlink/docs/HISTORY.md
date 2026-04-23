<!-- markdownlint-disable MD024 -->

# Pre-`2.0` history

Archive of the `1.x` release notes and the internal milestones between `1.5.2` and `2.0.0`. The active log lives in [`CHANGELOG.md`](../CHANGELOG.md); this file exists so future entries stay proportional and so a commit hash from the docs.plus alpha-v2 timeline still has a documented home.

---

## Pre-`2.0` development history

Between `1.5.2` and `2.0.0` the package went through several internal major revisions inside the `docs.plus` monorepo. None were promoted to the `@latest` npm dist-tag; everything user-facing from this stretch is rolled up into the `2.0.0` entry in `CHANGELOG.md`. The milestones are recorded here for anyone tracing a commit hash back to a documented release phase:

- **Monorepo migration** _(late 2023 – early 2024)_ — moved from a standalone repository into `docs.plus/packages/extension-hyperlink`; adopted `catalog:` dependency pins.
- **Build rewrite** _(2024)_ — migrated to `tsup` (ESM + CJS + DTS dual emit); introduced the 50+ special URL scheme catalog; added markdown link input rules (`[text](url)`) and image-syntax protection for autolink.
- **Popover + XSS overhaul** _(April 2026)_ — replaced the ~800 LOC `FloatingToolbarManager` class with a lean functional module; hardened every entry point against `javascript:` / `data:` / `vbscript:`; unified write-boundary canonicalization; shipped the default stylesheet as a separate import; stood up the clean-room Cypress harness.
- **Contract tightening** _(April 2026)_ — brand-neutral `SpecialUrlType`; bare phone / email / host:port canonicalization; `export *` eliminated from the public barrel; popover scroll-stickiness fix; Bun-native unit test suite.

A single pre-release, `4.3.0`, was briefly published to the `@next` dist-tag during the April 2026 contract-tightening phase and then unpublished ahead of the `2.0.0` alignment release. If you installed from `@next` during that window, upgrade directly to `2.0.0`.

---

## [1.3.7] — 2023-07-26

Version bump only.

## [1.3.6] — 2023-07-26

Version bump only.

## [1.3.5] — 2023-07-26

Version bump only.

## [1.3.4] — 2023-07-25

### Fixed

- Hide popover on outside click.
- Prevent popover from displaying in the wrong position.
- Fix typo.

## [1.3.3] — 2023-07-23

Version bump only.

## [1.3.2] — 2023-07-21

### Fixed

- Fix interfaces and types.
- Fix replacing hyperlink with new text.
- Fix selecting closest anchor element.
- Fix wrong selection of the anchor node.

## [1.3.1] — 2023-07-20

### Fixed

- Fix interfaces and types.
- Fix replacing hyperlink with new text.
- Fix selecting closest anchor element.
- Fix wrong selection of the anchor node.

## [1.3.0] — 2023-07-20

### Fixed

- Fix interfaces and types.
- Fix replacing hyperlink with new text.
- Fix selecting closest anchor element.

## [1.2.1] — 2023-07-19

### Fixed

- Fix interfaces and types.

## [1.2.0] — 2023-07-19

Version bump only.

## [1.1.0] — 2023-07-18

Version bump only.

## [1.0.4] — 2023-07-17

Version bump only.
