<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/webapp` are documented here.

This file is the pad UI changelog. Write pad UI notes here. Write the
product announcement in the [root CHANGELOG](../../CHANGELOG.md). Do not
copy a bullet into both. The backend lives in
[`apps/hocuspocus.server/CHANGELOG.md`](../hocuspocus.server/CHANGELOG.md).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

### Added

- History paints the latest Pad title rename above the editor. Chat paints
  the live username, then the snapshot name if the users join is missing.
  A Documents-list rename of the open pad writes the header and relays the
  room when a provider exists.

### Fixed

- An ownerless Pad title stays editable after the metadata fetch. A missing
  or empty `ownerId` is open. The control waits for `documentId` so a
  pre-sync row does not flash as editable.

- A live chat notice used to say "someone" because a realtime INSERT has
  no users join. The chip now uses the snapshot username until that join
  is present.

## [2.0.1] — 2026-08-31

This package shared `2.0.1` with hocuspocus. The product notes are in the
[root CHANGELOG](../../CHANGELOG.md#201--2026-08-31).
