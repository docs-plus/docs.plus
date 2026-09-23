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

- Your own empty profile card keeps one row: "No bio or links yet." and
  Add bio and links. The button opens Settings on Profile.

- History paints the latest Pad title rename above the editor. Chat paints
  the live username, then the snapshot name if the users join is missing.
  A Documents-list rename of the open pad writes the header and relays the
  room when a provider exists.

- `AvatarStack` `showActivity` paints an activity chip (`Icons.emoji` or
  `Icons.mic`) on a face's top-right corner, in `ParticipantsList` and
  `TocRowTrail`. It pops in over 200 ms, then plays `avatar-typing` 6 times
  (4.8 s, under the 5 s line in WCAG 2.2.2). The wire is `startActivity` /
  `stopActivity` on `typingIndicator`: 300 ms start delay, 3 s keepalive, 8 s
  expiry.

### Changed

- `useVoiceRecorder` takes `onSend` and returns `sendPreview` and `discard`,
  not `onAttach`, `confirmAttach`, and three reset paths. `useSendVoiceWhenReady`
  sends a released note once its tile is ready. `addFiles` returns the ids it
  queued and creates each row before its upload starts. `MessageMediaItem`
  gains `duration` and `waveform`, which `readAudioShape` sets for voice notes.

- The sign-in form checks the email on rest-api, not on Next.

- The composer + menu is a dialog named Insert, with plain buttons and no
  menu roles.

- On a phone, the small composer controls grow to 44 px (`min-h-11 min-w-11`).
  Each attachment tile gets a 44 px remove button beside it.

- An own optimistic chat row carries `data-status` (`pending` or `failed`) on
  the card root. The status paints in the timestamp slot.

### Fixed

- `_chat-editor.scss` drops its unlayered `touch-action: manipulation` rule on
  `.composer-bar__actions .btn`. It overrode the mic's layered `touch-none`.

- The typing keyframe never ran. `.animate-badge-entry` came after
  `.avatar-typing` with the same specificity, so it won `animation`. A combined
  rule now plays both.

- `useChannelMessages` set `newestSeqRef` to null for an empty first window.
  The realtime drain reads null as "not loaded", so the first echo never
  merged. An empty first window now sets 0.

- `useJumpTo` waits until the new window lands. A send far from the tail
  appended into the old window, and the landing dropped the optimistic row.

- The desktop composer skeleton matches the loaded composer's geometry. A
  channel load error renders no composer and no skeleton.

- The composer input has no positive `tabindex`. Inline code and the mobile
  format grid show their active state.

- The composer link dialog opens and closes on the dialog motion tokens
  (`MOTION_DIALOG_IN_MS` / `MOTION_DIALOG_OUT_MS`).

- An ownerless Pad title stays editable after the metadata fetch. A missing
  or empty `ownerId` is open. The control waits for `documentId` so a
  pre-sync row does not flash as editable.

- A live chat notice used to say "someone" because a realtime INSERT has
  no users join. The chip now uses the snapshot username until that join
  is present.

- Compare opened from a change notification no longer diffs against the
  wrong version when a quick second list is refused.

- Show older no longer leaves the Last-left version between two pages.

### Removed

- Next routes for Validate, Status, and Confirm. The service worker no longer
  writes user status.

### Internal

- Tab close holds the JWT in a ref and PATCHes `users` with keepalive.

- Chat stores and broadcast payloads have real types, not `any`. The unused
  typing map, the dead pin listener, and dead composer code are gone. The
  composer `ToolbarButton` takes a plain `isActive`.

- The desktop emoji picker no longer re-renders on every chat store change.

- The chat agent docs and the design system match the code again.

## [2.0.1] — 2026-08-31

This package shared `2.0.1` with hocuspocus. The product notes are in the
[root CHANGELOG](../../CHANGELOG.md#201--2026-08-31).
