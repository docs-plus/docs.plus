<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/github-relay` are documented here.

This app is private and ships inside docs.plus, so each heading names the docs.plus release that carried the change. The `version` in its `package.json` is not a release line. Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

### Added

- Initial standalone `@docs.plus/github-relay` Bun and SQLite webhook relay service (`apps/github-relay/`).
  - Verifies GitHub webhook signatures (`X-Hub-Signature-256`) on `POST /webhook/github` and returns `202` in milliseconds into per-channel SQLite WAL FIFO queues with delivery-ID deduplication, batch windows, star cooldowns, and `entity -> message_id` anchors.
  - Renders live-updating Discord Components V2 cards via the REST-only Bot API (updating existing anchors with `PATCH`, threading updates via `message_reference`), posts scheduled weekday triage digests and Friday shipped recaps, and exposes `GET /health` plus internal `POST /internal/digest`.
  - Ships with `Dockerfile`, `.env.example`, `discord-users.json`, and 24 unit tests (`bun run --filter @docs.plus/github-relay test`).
