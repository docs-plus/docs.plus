<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/document-swarm` are documented here.

This package is private and ships inside docs.plus, so each heading names the docs.plus release that carried the change. The `version` in its `package.json` is not a release line. Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

### Internal

- `playwright` moves from `^1.64.0` to `^1.64.1`.

## [2.1.0] — 2026-10-13

### Fixed

- `provision` reads every Swarm Actor `userId` back from Auth on each run. Before, it reused the
  ids in `actors.json`. After a `db reset` the same emails get new ids, so that file gave wrong
  owners. Rerun `provision` after a `db reset`.

### Internal

- `playwright` moves from `^1.61.1` to `^1.64.0`.

## [2.0.0] — 2026-08-26

### Added

- `@docs.plus/document-swarm` is an internal Bun CLI. It drives N seeded Swarm Actors into a
  public, editable document through Playwright. They write prose, build task lists, draft an
  academy-style outline and chat under headings.
- `provision` creates or reuses the `swarm-actor-<n>` accounts and writes `actors.json`. `run`
  has two modes: `demo` (headed, paced, until stopped) and `stress` (headless, bounded, concurrent
  load). `make swarm-demo` and `make swarm-stress` wrap `run`.
- Only `localhost`, `127.0.0.1`, `*.local`, `stage.docs.plus` and `*.stage.docs.plus` are allowed
  as the Swarm Host. The Actor cap is 20 local and 10 stage, unless you pass `--force`. A Private,
  Read-only, soft-deleted or missing document is refused before any browser opens. Each run ends
  with a Swarm Report and an exit code.
