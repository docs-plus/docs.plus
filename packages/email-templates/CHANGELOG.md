<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to `@docs.plus/email-templates` are documented here.

This package is private and ships inside docs.plus, so each heading names the docs.plus release that carried the change. The `version` in its `package.json` is not a release line. Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](../../RELEASE_POLICY.md).

---

## [Unreleased]

### Changed

- `DigestDocument.workspace_id` is now required. It holds the exact-case documentId
  ([#661](https://github.com/docs-plus/docs.plus/issues/661)).

## [2.1.0] — 2026-10-13

### Added

- **`buildDigestEmail` is the one digest entry point.** It returns `subject`, `html` and `text`
  together, so the subject count and both bodies cannot disagree. `countDigestItems` counts each
  chat line, plus one per Change digest block.
- **The plain-text parts live beside the HTML.** `buildNotificationEmailText` and
  `buildNewDocumentEmailText` build the plain text of the other two mail kinds.
- **The digest shows what changed in each document
  ([#201](https://github.com/docs-plus/docs.plus/issues/201)).** A `DigestDocument` can carry
  `content_changes`, the sections that changed in the window. `walkDigest` builds one block list.
  The HTML and the plain text only paint that list.
- **The digest is a document sheet.** `base.eta` takes `frame: 'sheet'`: a white sheet up to 960px
  wide on a gray well. Other mail keeps `frame: 'card'`. The top bar holds the mark, the title, a
  bell with the digest item count, and the reader's initials. The mark and the bell are hosted
  PNGs, because Gmail strips inline SVG. Under each changed heading, notices come first, then
  the passage. Added words are washed green, and removed words are red and struck through. The
  plain text marks them `{+...+}` and `[-...-]`.
- **Each changed heading shows its state
  ([#448](https://github.com/docs-plus/docs.plus/issues/448)).** An added heading is washed green,
  and a removed one is red and struck through. A heading carries one muted label: "Heading level
  changed" or "Moved". A modified heading with no passage reads "Edited". A nameless heading reads "Untitled heading". A
  block with no sections says that the document changed.
- **The change window and the contributors.** `changeWindowLine` reads "Changed since you left",
  with how long ago. Without a usable Last left, it reads "Changed in the last day" or "Changed in
  the last week", or it names a start date. `contributorLine` names how many people contributed.
  It returns an empty string for 0, so "0 people contributed" never ships.
- **`fitDigestDocuments` shrinks a digest until its HTML fits a byte limit.** It drops the oldest
  chat first. It then shortens one passage, and it cuts only a context run that follows an edit.
  Change runs stay whole, and a heading that changed is never removed. A `gap` run marks
  skipped context.
- `DigestChannel.heading_id` holds the heading toc-id of a heading chat
  ([#402](https://github.com/docs-plus/docs.plus/issues/402)). A payload queued before that change
  has none.
- `getEmailSubject` answers `content_change` with "A document you follow changed".
- The digest payload types live in `src/types.ts` and are exported: `DigestDocument`,
  `DigestChannel`, `DigestNotification`, `DigestContentChanges`, `DigestChangedSection`,
  `DigestChangeRun`, `DigestFrequency` and the `NotificationType` union.

### Changed

- **The unsubscribe page asks before it changes anything
  ([#445](https://github.com/docs-plus/docs.plus/issues/445)).** With `confirm`,
  `renderUnsubscribePage` renders an Unsubscribe button. The button posts `confirm=yes` to the
  same URL. The Unsubscribe button and the Manage preferences link darken on hover.
- The unsubscribe page is rebuilt as a server-rendered twin of the webapp PageCard. It follows the
  device's dark mode.
- One resolved footer per mail. `EmailFooter` carries the unsubscribe URL, its label and the
  preferences URL together, so the label and the URL cannot name different scopes.
  `footerLinksText` gives the plain-text part the same links as the HTML.
- `FONT_STACK` is now `Helvetica, Arial, sans-serif`, the app type stack.

### Fixed

- **Footer links no longer open a blank document.** View All Notifications linked
  `/notifications`, and Manage preferences linked `/settings/notifications`. The app has no page at
  either address. They now open the first document with `#notifications`, and
  `/#settings?tab=notifications`. The unsubscribe page uses the same Manage preferences link.
- The digest footer labelled a digest-only link "Unsubscribe from all". A per-type label such as
  "Unsubscribe from replies" could carry the all-mail URL. The plain-text parts carried a fixed
  tokenless URL.
- The plain-text digest shows up to 5 lines per channel and 80 characters of each preview, like the
  HTML. Before, it showed 3 lines and 50 characters.
- Footer and meta text was too light. It now uses `COLORS.textMeta`, at least 4.5:1 on every
  ground.

### Removed

- The `renderDigestEmail` and `templateHelpers` exports. `buildDigestEmail` is the entry point,
  and templates reach the helpers through `it.h`.
- The `msoButton` helper, the `UnsubscribeLinks` type and the digest `periodStart` parameter.
- The `COLORS` keys `primaryLight`, `secondary`, `textLight`, `success` and `error`, and the
  `RADIUS` keys `sm` and `xl`.
- The `success`, `showManageLink`, `showUndoLink` and `token` parameters of
  `renderUnsubscribePage`. It takes `showHomeLink` and `confirm`.

### Internal

- `eta` moves from `^3.5.0` to `^4.6.0`.
- The `test` script sets `APP_URL` and `NEXT_PUBLIC_APP_URL` to `https://docs.plus`. A local
  `.env.local` that points at localhost no longer breaks the digest snapshot.

## [2.0.0] — 2026-08-26

### Added

- **eta templates for every mail the server sends.** `renderNotificationEmail`,
  `renderDigestEmail` and `renderNewDocumentEmail` wrap their body in `base.eta`. eta escapes
  `<%= %>` output by default. `renderUnsubscribePage` renders a standalone HTML page.
- **Subjects and mail headers.** `getEmailSubject` names the subject for each notification type.
  `buildListUnsubscribeHeaders` builds the RFC 8058 one-click `List-Unsubscribe` and
  `List-Unsubscribe-Post` headers.
- **Shared tokens and helpers.** `COLORS`, `SPACING`, `RADIUS`, `FONT_STACK`, `APP_NAME` and
  `APP_URL` hold literal values, because mail clients ignore CSS variables. `templateHelpers`
  holds the avatar, the button, the Outlook VML button and the footer links.

### Security

- `avatar()` draws only an `http:` or `https:` URL. Any other value falls back to initials, so a
  stored avatar URL cannot add markup to the mail. `button()` and `msoButton()` escape their label.

### Internal

- `bun test` pins each template with a snapshot and checks input escaping.

---

## Pre-`2.0` history

The folder started on 2023-05-26 (`bcbe9d6e5`) with static Supabase sign-in templates:
`magic-link.html`, then `change-email-address.html`. On 2026-02-17 (`03a582009`) it became the
`@docs.plus/email-templates` package, with the eta engine and five `.eta` templates. The two
Supabase templates moved to `templates/` in the hocuspocus server, where they still live.
