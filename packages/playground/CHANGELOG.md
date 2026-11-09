<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/playground` are documented here.

This package is private and ships inside docs.plus, so each heading names the docs.plus release that carried the change. The `version` in its `package.json` is not a release line. Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

## [2.3.0] — 2026-11-09

### Internal

- `playwright` moves from `^1.64.0` to `^1.64.1`.

## [2.2.0] — 2026-10-22

### Fixed

- The Discord link in the page footer works again. It points at the `25JPG38J59` invite
  ([#480](https://github.com/docs-plus/docs.plus/issues/480)).

## [2.1.0] — 2026-10-13

### Added

- `recordDemo`, exported as `@docs.plus/playground/recordDemo`, records an extension demo GIF. It
  plays a story in the playground with Playwright, once in light and once in dark. Then `ffmpeg`
  writes `assets/demo-light.gif` and `assets/demo-dark.gif`.
- The story must call `mark('start')` and `mark('end')`, which bound the GIF. The crop follows the
  playground card at each mark. The optional `cut` drops a span of raw video, for example a slow
  loading shell.
- The `docs:gif` scripts in `extension-hyperlink` and `extension-hypermultimedia` call
  `recordDemo`. `playwright` is a new devDependency, and `ffmpeg` must be installed.

## [2.0.1] — 2026-08-31

### Fixed

- The Discord link in the page footer works again. It points at the `2EmAjmgZ8` invite.

## [2.0.0] — 2026-08-26

### Added

- `@docs.plus/playground` is the shared clean-room harness for the `@docs.plus/extension-*`
  Cypress suites. Each extension commits only its `main.ts` fixture.
- The `docs-playground --entry <main.ts> --port <n>` server builds the page shell with Bun and
  serves it on `127.0.0.1`. `--readme-media-dir` serves sample media at `/readme-media/*`. The
  browser helper `setupPlayground` sets the title, the GitHub link, the theme tokens and the theme
  toggle.
- Cypress helpers: a `cypress/tsconfig.json` base, `readmeGallery` and `flattenReadmeScreenshots`
  for README gallery screenshots, and `markdownCommands` for `cy.setMarkdown` and
  `cy.getMarkdown`.
