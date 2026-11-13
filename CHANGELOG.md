<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to docs.plus are documented here.

This file is the product changelog. Every app, package and extension keeps its own `CHANGELOG.md` with the detail, for example [`apps/webapp/CHANGELOG.md`](apps/webapp/CHANGELOG.md), [`apps/hocuspocus.server/CHANGELOG.md`](apps/hocuspocus.server/CHANGELOG.md) and [`packages/supabase/CHANGELOG.md`](packages/supabase/CHANGELOG.md). [`RELEASE_POLICY.md`](RELEASE_POLICY.md) says which change goes where. Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Section headings follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) plus the house order in [`RELEASE_POLICY.md`](RELEASE_POLICY.md).

---

## [Unreleased]

### Added

- Two new MCP tools for AI apps. `move_block` moves one block inside a section, so a picture can
  change places with its caption and settings intact ([#720](https://github.com/docs-plus/docs.plus/issues/720)). `rewrite_section` writes a whole
  section body again from Markdown and keeps every picture, video and file in it. The Markdown
  names each media block by its number, and the tool refuses a write that would lose one
  ([#719](https://github.com/docs-plus/docs.plus/issues/719)).

### Changed

- Bold, italic, strike, highlight and links can now sit on inline code, as in Notion. Before,
  Markdown import dropped the bold from ``**`x`**`` and the MCP refused the write ([#721](https://github.com/docs-plus/docs.plus/issues/721)).
- Replace with a file now has a cap per person. The document owner may upload a Word file of up to
  40 MB; everyone else keeps 10 MB. Markdown stays at 65,536 characters for everyone, because a
  bench showed larger Markdown blocks the server ([#722](https://github.com/docs-plus/docs.plus/issues/722)).
- Home and pads load less JavaScript. The social-link icons now ship as the 71 icons they use,
  not three whole icon packs. In the build's route table, Home's first load drops from 3.82 MB to
  952 kB, and a pad's from 1.83 MB to 925 kB ([#732](https://github.com/docs-plus/docs.plus/issues/732)).

### Security

- Every import is now refused when it holds more than 50,000 nodes, nests deeper than 100
  levels, or when its saved state would pass 12 MiB. A larger document could not open in a browser
  ([#722](https://github.com/docs-plus/docs.plus/issues/722)).
- Three notification lookups no longer answer a signed-out caller. They now need a signed-in
  session, the only kind the app uses ([#755](https://github.com/docs-plus/docs.plus/issues/755)).
- Grafana's internal `/metrics` page is no longer public. Grafana stops making those metrics, and
  the public router refuses any path under `/metrics` ([#745](https://github.com/docs-plus/docs.plus/issues/745)).
- New dependency versions now wait 3 days before `bun add`, a new resolve, Dependabot or
  `bun run update` takes them, so a hijacked release can be pulled first. A frozen install of the
  lockfile is unaffected ([#653](https://github.com/docs-plus/docs.plus/issues/653)).

### Documentation

- The demo's 2.3.0 section names more fixes: the link rename, the empty title heading, imported
  links, phone link sheets, the iPhone chat icon, Google sign-in branding, the title-row Delete,
  Documents list rows that open in a new tab, and a link preview that no longer changes the
  document.
- The demo now names the Escape key, the three Link previews switches, the link form cleanup,
  underline in Markdown, five more fixes and four more safety changes. Its keys use ⌘ notation
  throughout.
- The whole demo now uses the editor's own formats: ordered and task lists, tables for keys and
  limits, quotes, highlights and a new Mermaid diagram. Every heading and every `/demo/<word>`
  filter link is unchanged. The Writing chapter now says that a highlight marks the one line a
  reader must see first.
- The demo now states the Word import cap per caller, shows bold inline code, and says a
  connected AI app can move a picture or rewrite a section without deleting media.

### Internal

- The `release-product` skill now requires a release note to cover every user-facing changelog
  entry. `.agents/skills/release-product/scripts/note-coverage.ts` lists each entry the note does
  not mention, as whole issue and commit tokens, and checks each sub-bullet. The 2.3.0 note had
  missed nineteen user-facing changes before this check. The `release-extensions` skill now says to
  re-record a package's demo GIF before a publish, because npm freezes the README.
- `note-coverage.ts` now lists entries whose issue the note cites but that share it with other
  entries. One `#242` link had marked eighteen entries as covered, among them the link keys and
  three privacy fixes. The skill now asks for a written decision per line in
  `Notes/release-X.Y.Z/COVERAGE.md`, and records the rule that a half mention is a miss.
- The observability deploy now loads the Grafana alert rules in a throwaway container first, so
  a broken rule file stops the deploy instead of looping Grafana. After the deploy it fails on any
  rule in error health and names each one ([#753](https://github.com/docs-plus/docs.plus/issues/753)).
- Prometheus now keeps up to 45 days of metrics, up from 15. Its size cap drops from 4 GiB to
  3 GiB, and Prometheus removes the oldest data first at that cap. The before-and-after reads for
  the host move need more than 15 days of history ([#749](https://github.com/docs-plus/docs.plus/issues/749)).
- Alert rules leave out health probes and metric scrapes, which were 92.8 % of REST requests. A
  failing database health check now warns on its own, and MCP latency has its own 5 s rule
  ([#710](https://github.com/docs-plus/docs.plus/issues/710)).
- The dead stage pipeline is removed: `stage.docs.plus.yml`, the staging env template and the stage
  notes in the agent docs ([#725](https://github.com/docs-plus/docs.plus/issues/725)). It never ran, because no `dev` branch exists, so CI
  time is unchanged.
- The chatroom and editor browser suites now alert Telegram only when a suite turns red after a
  green run. Over the last 30 chatroom and 16 editor push runs, that is 3 alerts in all instead of
  27, one per red run ([#557](https://github.com/docs-plus/docs.plus/issues/557)).
- Loki refuses a log query that spans more than 7 days, or any range inside a query longer than 25
  hours, instant queries included. One 7-day instant query had read 2.7 GB and taken Loki to
  94.8 % of its memory limit ([#712](https://github.com/docs-plus/docs.plus/issues/712)).
- Loki gets 768 MiB, up from 512 MiB, with `GOMEMLIMIT` at 576 MiB. It idled at 448–485 MiB, up to
  95 % of the old limit ([#712](https://github.com/docs-plus/docs.plus/issues/712)).
- Alloy drops the routine lines of `loki`, `glitchtip-worker` and `docker-socket-proxy` before
  they reach Loki. Together they were 1.38 million lines a day, 92.5 to 94.2 % of all stored lines.
  Warn and error lines, Loki's slow-query log and refused proxy calls still arrive. No drop touches
  an app service. A new warning, `loki-memory-high`, fires when Loki stays above 80 % of its
  memory limit for 10 minutes ([#712](https://github.com/docs-plus/docs.plus/issues/712)).
- Three new alert rules watch the shared collab Postgres cluster. Two fire when the size of its
  databases plus WAL room passes 60 % of the disk (warning) and 80 % (critical). The third warns
  when they grow more than 128 MiB in 24 hours. Over 15 days of history it would have fired once,
  on the 2026-11-07 growth ([#727](https://github.com/docs-plus/docs.plus/issues/727)).

## [2.3.0] — 2026-11-09

### Highlights

- **Links now show where they go.** A link icon before each pad link shows the site's
  favicon, the docs.plus logo, or a mail or phone glyph. A link with no icon stays a plain
  link. Links in posted chat messages show the same icons ([#516](https://github.com/docs-plus/docs.plus/issues/516),
  [#678](https://github.com/docs-plus/docs.plus/issues/678)).
- **A hovercard previews a link before you open it.** On a desktop pad, rest the pointer on
  a link. A web link shows the page's picture, title and description, and our server fetches
  all of it. A link to another pad, a heading, a chat or a version gets its own card
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- **A shared pad link shows what is inside.** In a chat app or on a social site, the link to a
  public pad with an owner shows a social card. The card has the pad's name and its first
  paragraph or section names. It never shows a person's name, a face or message text, and a Private pad never gets
  one. Self-hosters turn each kind on with `SOCIAL_CARD_KINDS`
  ([#663](https://github.com/docs-plus/docs.plus/issues/663)).
- **Faster and steadier.** In a dev build, the frame that first draws a 2000-link pad took
  213 ms before this release, with no link icons. Now it takes 129 ms with the new icons ([#516](https://github.com/docs-plus/docs.plus/issues/516)). In
  headless Chrome on a dev build, 20 reloads used to leave 42 offline copies (22.6 MB). Now
  one copy stays (0.55 MB) ([#638](https://github.com/docs-plus/docs.plus/issues/638)). A
  slow Supabase read no longer sends a pad to the error page. The pad renders in about 2 s
  when one read stalls, or about 4 s when both do ([#596](https://github.com/docs-plus/docs.plus/issues/596)).

### Breaking

- Pull `traefik:v3.6` at 3.6.18 or later, or Traefik does not start. The bundled
  `traefik.yml` now drops query strings from the access log, and older builds refuse that key
  ([#515](https://github.com/docs-plus/docs.plus/issues/515)). After the pull,
  `docker run --rm traefik:v3.6 version` prints the build you have.
- Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, or the production worker reports
  unhealthy. The repository deploy then rolls back
  ([#608](https://github.com/docs-plus/docs.plus/issues/608)).
- `get_document_member_previews`, `get_document_members` and
  `admin_get_document_member_counts` take a document id, not a slug. `p_slugs` becomes
  `p_document_ids`, and `p_slug` becomes `p_document_id`. The webapp and the REST server in this
  release send the new names ([#574](https://github.com/docs-plus/docs.plus/issues/574)).
- `POST /api/email/send-digest` is removed, and it now answers 404. Nothing in the repo called
  it. Digests send only through the email queue
  ([#661](https://github.com/docs-plus/docs.plus/issues/661)).

### Migration

**If you self-host.** Read the [hocuspocus Migration](apps/hocuspocus.server/CHANGELOG.md#migration)
before you deploy, and follow its order. This release adds eight Supabase migrations. Seven go
with the backend and frontend deploy. `20261103120000` goes only after the backend is live
([#661](https://github.com/docs-plus/docs.plus/issues/661)). Until `20261023120000` and the backend both land, the member
faces, the roster and the admin member counts fail
([#574](https://github.com/docs-plus/docs.plus/issues/574)).
[`packages/supabase/CHANGELOG.md`](packages/supabase/CHANGELOG.md) says what each migration does.

The Supabase Auth mail templates moved to
[`packages/supabase/templates/`](packages/supabase/templates/). After the frontend deploy, paste
`magic-link.html` into **Magic Link** and `confirm-signup.html` into **Confirm signup**. Paste
them after the deploy, not before: the new links need the new frontend.

The deploy's `migrate` step applies two Prisma migrations for the social card. Before you turn on the `document`
card kind (`SOCIAL_CARD_KINDS`), run `scripts/backfill-card-data.ts` once in a one-off container: a dry run first, then `--apply`
([#663](https://github.com/docs-plus/docs.plus/issues/663)).

The new optional setting `APP_HOSTS` lists the hosts that serve pads. Empty means the `APP_URL`
host and its `www.` form. Each entry is a bare host name, such as `docs.plus`. A scheme, a port or
a path stops the server at boot. See
[hocuspocus Security](apps/hocuspocus.server/CHANGELOG.md#security)
([#687](https://github.com/docs-plus/docs.plus/issues/687)).

Four more new settings are optional. `SOCIAL_CARD_KINDS` is empty by default, so every pad link
shows the Fallback card until you turn kinds on. `GITHUB_TOKEN` and `STACKEXCHANGE_KEY` raise the
quotas for link preview facts. `LINK_ICON_MAX_BYTES` caps one link icon, at 32768 bytes by
default. [`apps/hocuspocus.server/ENV.md`](apps/hocuspocus.server/ENV.md)
describes each one.

**If you use the npm extensions.** All six `@docs.plus/extension-*` packages raise their
`@tiptap/core` and `@tiptap/pm` peer floor to `^3.32.2`. Upgrade both first. No export or option
was removed. The hyperlink and hypermultimedia defaults and output changed, so read
[`extension-hyperlink` migration](extensions/extension-hyperlink/docs/migration.md) and
[`extension-hypermultimedia` migration](extensions/extension-hypermultimedia/docs/migration.md).
[`extension-mermaid`](extensions/extension-mermaid/CHANGELOG.md) now hands non-Mermaid code
blocks to the next node view ([#627](https://github.com/docs-plus/docs.plus/issues/627)).

### Added

- A media node keeps its caption and its options through Markdown, on all nine media kinds
  ([#244](https://github.com/docs-plus/docs.plus/issues/244)). The caption rides in the
  Markdown title slot, `![video](url "My caption")`. Size, placement and player options ride
  in an option block after the link, `![video](url){width=800 controls=false}`. So an AI app
  that writes Markdown, a Markdown import and a Markdown export keep them. The guide is
  [Media in Markdown](docs/media-in-markdown.md).
- A shared pad link now shows a docs.plus card in chat apps and on social sites
  ([#663](https://github.com/docs-plus/docs.plus/issues/663)). A public pad with an owner shows
  its real content: its name, its first paragraph or its section names, and an "Open the
  document" link. From 3 members the card also says "N people joined". Every other pad link
  shows the Fallback card, the docs.plus homepage card. A section, a chat room, a message, a version or a filter
  link can get a card of its own. Each kind turns on with `SOCIAL_CARD_KINDS`, and every kind is
  off by default. Since 2026-11-03, docs.plus runs the pad card (`document`) only. A card never
  shows a name, a face or message text, and a Private pad never gets one.
- When a pad's description only repeats its title or address, the link preview shows the
  docs.plus description instead ([#663](https://github.com/docs-plus/docs.plus/issues/663)).
- The server icon route `GET /api/metadata/icon` finds a site's icon for pad links. It
  tries `/favicon.ico` first. When that file has no icon, it reads the site's page head, as
  on Notion. `LINK_ICON_MAX_BYTES` caps one icon at 32768 bytes by default, so the LinkedIn
  and Figma icons fit. A link with no icon gets an empty `204`, so the browser console shows
  no `404` ([#515](https://github.com/docs-plus/docs.plus/issues/515)).
- Every pad link shows a link icon before its text: the site's favicon, the docs.plus logo,
  or a mail or phone glyph. A link with no icon stays a plain link
  ([#516](https://github.com/docs-plus/docs.plus/issues/516)). A pasted link gets its icon too
  ([#636](https://github.com/docs-plus/docs.plus/issues/636)). Links in posted chat messages
  show the same icons, and a click opens the link preview
  ([#678](https://github.com/docs-plus/docs.plus/issues/678)).
- The Home Screen app now has a launch image for every current iPhone size, so no iPhone
  opens it on a black screen ([#255](https://github.com/docs-plus/docs.plus/issues/255)).
- On a desktop pad, rest the pointer on an external link and a hovercard opens. The request
  starts after 150 ms, and the card opens at 500 ms at the earliest. It shows the page's
  picture, site, title and description. Our server fetches all of it, so your browser sends
  nothing to the linked site. A click still opens the link preview
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- The hovercard shows up to three facts for some pages. A job page shows its place, work type
  and posting date. A GitHub repository shows stars, language and last push. A Stack Overflow
  question shows its answers ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- A docs.plus link has its own hovercard on the desktop pad. It covers a link to another pad, a
  heading, a chat, a message, a filter or a version. A Private pad you cannot open shows only
  "This document is private" ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- A web link with no preview says why, and warns when its text names another site. When the site
  blocked our server or did not answer, **View archived copy** asks the Wayback Machine for the
  closest copy ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- A link whose text is its own web address shows a **Use page title** button on its hovercard.
  One click puts the page title in place of the address
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- A web link pasted on its own into a pad shows the page title in place of its address
  ([#681](https://github.com/docs-plus/docs.plus/issues/681)). One undo brings the address back.
  ⌘+⇧+V (Ctrl+Shift+V) pastes the address as is.
- A link to another docs.plus pad, pasted on its own into a pad, shows that pad's title
  ([#680](https://github.com/docs-plus/docs.plus/issues/680)). A link to a Private pad keeps its
  address.
- Settings → Appearance has a "Link previews" card with three switches: hovercards, page titles
  for pasted links, and pad titles for pasted pad links. Each switch is on by default, is stored
  per browser, and applies only while you are signed in. A visitor who is not signed in gets all
  three on ([#242](https://github.com/docs-plus/docs.plus/issues/242),
  [#681](https://github.com/docs-plus/docs.plus/issues/681),
  [#680](https://github.com/docs-plus/docs.plus/issues/680)).
- A link to a part of this pad shows as a chip with its kind icon: heading, chat, filter, version
  or top ([#174](https://github.com/docs-plus/docs.plus/issues/174)). A filter link's preview
  names every term.
- With the caret inside a link, Mod+K opens its preview and Alt+Enter opens the link. Mod-click
  opens a new tab. Links show the hand cursor only while Mod is held
  ([d21895f01](https://github.com/docs-plus/docs.plus/commit/d21895f01),
  [9789e6577](https://github.com/docs-plus/docs.plus/commit/9789e6577)).
- The tick rail section preview is now a card you can use
  ([#645](https://github.com/docs-plus/docs.plus/issues/645)). Its chat button opens that
  heading's chat. The keyboard can Tab into the card and leave it with Escape.
- A History share link carries `?version=<n>`, so it opens History at that version, and the server
  can draw that version's card ([#668](https://github.com/docs-plus/docs.plus/issues/668)).
- DOCX import accepts every tracked change in a file and says so, with the new warning code
  `tracked-changes-accepted` ([#662](https://github.com/docs-plus/docs.plus/issues/662)).

### Changed

- Markdown export writes a resized audio or video as `![video](url){width=400 height=300}`. It
  wrote `![video](url width=400 height=300)` before. Import still reads the old form
  ([#244](https://github.com/docs-plus/docs.plus/issues/244)).
- Markdown import reads text in braces right after a picture or a player as an option block. So
  `![chart](chart.png){draft}` now loses `{draft}`. Before, that text stayed in the pad. Put a
  space before the brace to keep it ([#244](https://github.com/docs-plus/docs.plus/issues/244)).
- A pad link to the docs.plus home page or to `new.docs.plus` now shows the docs.plus logo, as
  a link to another pad does. It showed the site icon before
  ([#516](https://github.com/docs-plus/docs.plus/issues/516), maintainer ruling 2026-11-09).
- Markdown export, and what an AI app reads, now writes underlined text as `<u>text</u>`. Before,
  it wrote `++text++`. Markdown import reads only `<u>` now, so older `++text++` comes in as
  plain text. The change comes from TipTap 3.32.2
  ([7c3d7d26c](https://github.com/docs-plus/docs.plus/commit/7c3d7d26c)).
- Google sign-in now shows "docs.plus" in Google's account chooser, not the Supabase project
  address. Supabase Auth answers on the custom domain `auth.docs.plus`, and Google verified the
  docs.plus brand. A self-hoster can do the same: see
  [Turn on Google sign-in](docs/self-hosting/configuration.md#turn-on-google-sign-in).
- The privacy page now says how docs.plus uses the data that Google sign-in sends, and lists
  your data rights. It also says which link data goes to our server, to GitHub, to Stack
  Exchange and to archive.org
  ([a19f6f7c1](https://github.com/docs-plus/docs.plus/commit/a19f6f7c1),
  [9faaae60d](https://github.com/docs-plus/docs.plus/commit/9faaae60d)).
- The production deploy now aborts below 20 GB free disk, up from 10 GB. It prunes Docker
  build cache toward a free-space target, not by age
  ([#564](https://github.com/docs-plus/docs.plus/issues/564)).
- The production deploy now stops when `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  differ ([#609](https://github.com/docs-plus/docs.plus/issues/609)).
- When several people edit one document on two collaboration replicas, fast typing costs less
  Redis traffic. On a 5.36 MB edited document, one keystroke cost 281 KB. Now it costs about 70
  KB at one key per 50 ms, and 120 to 127 KB at one key per 100 ms (two sessions). A patch on
  `@hocuspocus/extension-redis` 3.4.4 sends the sync request at most once per 250 ms
  ([#595](https://github.com/docs-plus/docs.plus/issues/595)).
- The frame that first draws a large pad is shorter. The editor now mounts before the first sync, so a
  cold load builds each block once. Before, it built each block four times in dev, and twice in
  production by our code trace. In a dev build, on a 2000-link pad, the link icons add 26 ms to
  the first fill frame instead of 117 ms
  ([#516](https://github.com/docs-plus/docs.plus/issues/516)).
- The production deploy builds the images in their own `images` job first. The deploy stops
  before it changes production when an image is missing, or when the host env file changed
  between the two jobs ([#565](https://github.com/docs-plus/docs.plus/issues/565)).
- Link previews are read by our own page parser, not metascraper. On a snapshot of 95 page
  heads, on one laptop, it parsed the median page in about one seventh of the time. It also finds pictures and
  descriptions that some sites tag in a non-standard way ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- The link preview server reads only the page head, up to 1 MiB, and
  names itself as `DocsplusBot`, never as another crawler
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- The page's picture in the hovercard, and the Vimeo, SoundCloud, Spotify and Loom thumbnails
  in chat and Insert media, now load through our server (`GET /api/metadata/image`). Link icons
  come only from our icon route. The privacy page lists what still loads straight from other sites
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- Link metadata and its image route spend their own rate-limit bucket, at ten times
  `RATE_LIMIT_MAX` per 15 minutes. So hovering does not use up the main API budget
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- Copied and shared pad links are easier to read. Pasted into a rich editor, a heading link reads
  like a breadcrumb, `…/demo?h=docs.plus-demo>whats-new>docs.plus-2.2.0&id=…`, and a filter link like
  `/demo/draw-a-diagram`. A link you copy no longer carries your open filter or chat
  ([#646](https://github.com/docs-plus/docs.plus/issues/646)).
- A desktop TOC drag now moves a section like a folder in a file manager
  ([#499](https://github.com/docs-plus/docs.plus/issues/499)). The drop slot sets the level. A
  drop on the middle of a row nests the section inside that row.
- A paste from the same pad keeps each heading's id, so a full cut and paste keeps heading chats
  and `?id=` links ([#700](https://github.com/docs-plus/docs.plus/issues/700)).
- A heading with no text now has a TOC row, with a grey label such as "Heading 2"
  ([#499](https://github.com/docs-plus/docs.plus/issues/499)).
- A plain click on a link to another pad opens that pad in the same window, in the pad and in
  chat. Mod-click and middle-click still open a new tab
  ([#359](https://github.com/docs-plus/docs.plus/issues/359)).
- A plain link in the pad and the chat composer underlines on hover. Before, it faded
  ([02ca037bf](https://github.com/docs-plus/docs.plus/commit/02ca037bf)).
- **Extensions.** Each of the six `@docs.plus/extension-*` packages has changes for the next
  family release. Each package's `CHANGELOG.md` holds the detail.
  - [`extension-hyperlink`](extensions/extension-hyperlink/CHANGELOG.md): link icons, the
    hovercard, page titles for pasted links, link keys, and one `navigate` option for every link
    it opens ([#242](https://github.com/docs-plus/docs.plus/issues/242),
    [#513](https://github.com/docs-plus/docs.plus/issues/513),
    [#514](https://github.com/docs-plus/docs.plus/issues/514)).
  - [`extension-hypermultimedia`](extensions/extension-hypermultimedia/CHANGELOG.md): captions
    and options through Markdown, captions through HTML, and images with no file extension
    ([#244](https://github.com/docs-plus/docs.plus/issues/244),
    [#637](https://github.com/docs-plus/docs.plus/issues/637)).
  - [`extension-mermaid`](extensions/extension-mermaid/CHANGELOG.md): `mermaidNodeView` for
    your own code block view, and other code blocks pass through
    ([#627](https://github.com/docs-plus/docs.plus/issues/627),
    [#628](https://github.com/docs-plus/docs.plus/issues/628)).
  - [`extension-indent`](extensions/extension-indent/CHANGELOG.md),
    [`extension-inline-code`](extensions/extension-inline-code/CHANGELOG.md) and
    [`extension-placeholder`](extensions/extension-placeholder/CHANGELOG.md): no source change.
    They raise the Tiptap peer floor, and all three update their docs.

### Fixed

- Renaming a link no longer removes it when its old text was a web address, such as an
  autolinked `example.com` or a pasted link whose title holds a domain
  ([extension-hyperlink](extensions/extension-hyperlink/CHANGELOG.md)).
- On a phone, the link sheet for a `mailto:`, `tel:` or `slack://` link shows a mail, phone or
  Slack icon, as the desktop preview does. It showed an empty grey box before
  ([#517](https://github.com/docs-plus/docs.plus/issues/517)).
- **Folded sections open again.** A folded section stayed shut. A click on its fold in the pad
  or on its arrow in the table of contents did nothing
  ([3ad154202](https://github.com/docs-plus/docs.plus/commit/3ad154202)).
- **Email sign-in works from any browser.** A sign-in link opened in a mail app's own browser,
  such as Gmail's, signed in nowhere. The link now signs in wherever it opens, and sign-in
  errors say what to do next
  ([7d6fe22c4](https://github.com/docs-plus/docs.plus/commit/7d6fe22c4),
  [f6539d7f6](https://github.com/docs-plus/docs.plus/commit/f6539d7f6)).
- **Sign-in no longer stops when the browser wrongly says offline.** Chrome can report offline
  after a Mac sleeps while the network works. Email sign-in, Google sign-in and online status
  then failed until Chrome restarted
  ([ede9e0224](https://github.com/docs-plus/docs.plus/commit/ede9e0224)).
- **The pad no longer adds an empty H1 at the end of every document**
  ([#572](https://github.com/docs-plus/docs.plus/issues/572)). A document that already ends in
  one keeps it until someone deletes it or replaces the document.
- **A slow database read no longer sends a pad to the error page.** The pad's owner and sign-in
  reads now wait at most 2 s each. A late owner read renders the pad without the owner's
  profile ([#596](https://github.com/docs-plus/docs.plus/issues/596)).
- **TOC moves are safer.**
  - Two people who move one section at the same time no longer leave two copies of it
    ([#510](https://github.com/docs-plus/docs.plus/issues/510)).
  - "Delete section" no longer shows on the title row, where it could delete the whole
    document. It also no longer shows on a locked pad, and a locked pad starts no drag
    ([#611](https://github.com/docs-plus/docs.plus/issues/611)).
  - A drop below a folded row lands after that row's whole section. A caret inside a dragged
    section moves with it ([#499](https://github.com/docs-plus/docs.plus/issues/499)).
- **Heading links and heading chats hold.**
  - A heading link lands on its heading, even when a fold or a filter hides it
    ([#338](https://github.com/docs-plus/docs.plus/issues/338)).
  - A Settings file replace keeps more heading chats, `?id=` links and folds. Its confirm card
    names each heading chat that holds messages and will lose them
    ([#474](https://github.com/docs-plus/docs.plus/issues/474)).
  - The file replace warning now says that History keeps the earlier version
    ([#662](https://github.com/docs-plus/docs.plus/issues/662)).
- **Small things in the pad work better.**
  - Opening a link preview no longer changes the document, so co-editors get no update
    ([#519](https://github.com/docs-plus/docs.plus/issues/519)).
  - Desktop link Edit works after a co-editor types above the link
    ([#678](https://github.com/docs-plus/docs.plus/issues/678)).
  - A `/new` link's preview says that it opens a blank document in a new tab
    ([6a7675247](https://github.com/docs-plus/docs.plus/commit/6a7675247)).
  - The phone edit toolbar stays hidden on a read-only pad
    ([#308](https://github.com/docs-plus/docs.plus/issues/308)).
  - After a heading deep link, the first Tab goes to "Skip to main content", not to a TOC row
    ([#309](https://github.com/docs-plus/docs.plus/issues/309)).
  - A push notification click marks the notification read when it opens a new window
    ([#312](https://github.com/docs-plus/docs.plus/issues/312)).
  - Documents list rows are real links, so a middle-click or a Cmd-click opens a new tab
    ([#699](https://github.com/docs-plus/docs.plus/issues/699)).
  - Pad addresses behave. A notification row names the document, not a filter term. A stale
    `?msg_id=` no longer opens another room. A tap on a heading in the phone TOC drawer keeps
    the heading in the address. A filter link with `%25` no longer throws
    ([#646](https://github.com/docs-plus/docs.plus/issues/646)).
  - The TOC does less work on long documents. The unread count no longer scans every chat for
    each row, and a sash drag resizes the TOC once per frame
    ([ea14e4ad4](https://github.com/docs-plus/docs.plus/commit/ea14e4ad4),
    [24b788e86](https://github.com/docs-plus/docs.plus/commit/24b788e86)).
- **Chat emails open the right pad.** An immediate chat email opened the home page, and a digest
  link could open a new empty pad. An immediate chat email now opens the pad at the message, and a
  digest opens the pad's chat ([#647](https://github.com/docs-plus/docs.plus/issues/647)). Each
  digest row now reads the status of its own mail, so the admin `sent` count is right.
- **The admin dashboard is safer.** A failed view-stats read now
  fails the stale-document audit and purges nothing. Before, it scored every document as never
  viewed ([#578](https://github.com/docs-plus/docs.plus/issues/578)). The MCP Usage page no
  longer fails with a 500 when no OAuth app is registered
  ([cf97baaf7](https://github.com/docs-plus/docs.plus/commit/cf97baaf7)).
- **Member faces show on every document again.** Documents made before 2026-08-09, the
  `/demo` pad among them, showed no faces in the Documents list, no roster and no admin
  member count. The lookup now uses the document's id, never its slug
  ([#574](https://github.com/docs-plus/docs.plus/issues/574)).
- **Imported links now open in the link preview.** Markdown import and connected-app (MCP)
  writes store links on the hyperlink mark, so the pad can preview and edit them
  ([#335](https://github.com/docs-plus/docs.plus/issues/335)).
- Document views keep the visit duration when the visit closes before the view queue drains
  ([#603](https://github.com/docs-plus/docs.plus/issues/603)).
- Typing in a diagram no longer highlights every code block in the pad again
  ([#631](https://github.com/docs-plus/docs.plus/issues/631)).
- The link preview shows the site's icon again, not a tiny copy of the page's picture. It asks
  only our icon route, and never shows the page's picture or a video thumbnail
  ([#633](https://github.com/docs-plus/docs.plus/issues/633)).
- The pad and chat link forms refuse text that is not one whole link. Before, `hello google.com`
  passed and was stored as `https://hello google.com`
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- The link forms store `google.com,` as `https://google.com`, and `user@example.com.` as an
  email link. Before, the trailing punctuation stayed in the stored link ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- Changing only a link's URL no longer undoes a co-editor's change to the link text
  ([#643](https://github.com/docs-plus/docs.plus/issues/643)).
- A typed link that ends in a closing parenthesis, such as a Wikipedia `Foo_(bar)` link, keeps
  it. Before, autolink cut the `)` off the stored link, in the pad and in chat
  ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- Pasting a link into an empty line no longer throws "Position tracking requires synchronized
  editor text" and drops the paste. `@tiptap/y-tiptap` 3.0.10 carries a `bun patch` until
  upstream ships a fix ([ueberdosis/tiptap#8584](https://github.com/ueberdosis/tiptap/issues/8584)).
  The Docker images copy `patches/` before each install.
- On iPhone Safari, the chat icon in the phone TOC drawer opens the chat again. The chat used to
  close as soon as it opened ([#639](https://github.com/docs-plus/docs.plus/issues/639)).
- The offline copy of a pad no longer grows on every load. It used to keep two more full copies
  of the document per reload, and every load decoded all of them. In headless Chrome on a dev
  build, 20 reloads of a 2000-link pad left 42 copies (22.6 MB) and a 202 ms frame. It now stays at one copy (0.55 MB)
  ([#638](https://github.com/docs-plus/docs.plus/issues/638)).
- **Phone editing on Android works with the keyboard up.** The slash menu and the link editor no
  longer drop the keyboard or leave edit mode
  ([#251](https://github.com/docs-plus/docs.plus/issues/251)). Enter just before a link with an
  icon no longer adds an empty line break
  ([#513](https://github.com/docs-plus/docs.plus/issues/513)).
- **Phone sheets work better with a keyboard and a screen reader.** Close returns focus to the
  link that opened the sheet. The page behind a sheet stays hidden from screen readers. Shift+Tab
  wraps inside the sheet ([#248](https://github.com/docs-plus/docs.plus/issues/248),
  [#310](https://github.com/docs-plus/docs.plus/issues/310)).
- **Pasted images no longer vanish.** Many image sites and CDNs serve images from an address
  with no file extension. Paste and HTML import dropped such an image with no warning. Now it
  stays. An image that fails to load says "Couldn’t load this image" and names its site. It no
  longer shows the browser's broken-image icon
  ([#637](https://github.com/docs-plus/docs.plus/issues/637)). Detail in
  [`extension-hypermultimedia`](extensions/extension-hypermultimedia/CHANGELOG.md).

### Security

- A table `colspan` is clamped to 64 on every export and on DOCX import. So one stored huge
  value can no longer make an export stop the REST process
  ([#662](https://github.com/docs-plus/docs.plus/issues/662)). Detail in
  [`apps/hocuspocus.server/CHANGELOG.md`](apps/hocuspocus.server/CHANGELOG.md).
- The webapp runs Next.js 15.5.28 and DOMPurify 3.4.17, for the October advisories. The admin
  dashboard runs Next.js 16.4.4. Redeploy both apps
  ([8f5b13f6e](https://github.com/docs-plus/docs.plus/commit/8f5b13f6e)).
- **Sentry stays on the narrow collection baseline.** `@sentry/nextjs` and `@sentry/bun` are
  `11.10.0`. Sentry 11 sends cookies and request bodies by default. `dataCollection` keeps the
  version 10 limits, and MCP tool text stays off
  ([7c3d7d26c](https://github.com/docs-plus/docs.plus/commit/7c3d7d26c)).
- **Site icons no longer come from Google.** Profile links, Settings links and link previews load
  site icons from the docs.plus server. Before, each icon sent the reader's IP address and the
  site to Google ([#517](https://github.com/docs-plus/docs.plus/issues/517)).
- **A link in a pad can no longer leak data through its icon.** An AI agent can be tricked into
  writing a link such as `https://<data>.attacker.example`. Every reader's pad then fetched that
  host's icon, so the data reached the attacker with no click. The icon route now fetches only
  the site's main domain ([#690](https://github.com/docs-plus/docs.plus/issues/690)).
- **A pad that turns Private hides its cached link cards.** Before, a link preview could show its
  title for up to 24 h after the pad turned Private
  ([#687](https://github.com/docs-plus/docs.plus/issues/687)).
- **Link card text drops control and bidi characters**, so a page title can no longer flip how
  a hovercard reads ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- **A chat email or digest leaves out a pad its reader cannot open,** such as someone else's
  Private pad or a pad in Trash ([#647](https://github.com/docs-plus/docs.plus/issues/647),
  [eefbb35de](https://github.com/docs-plus/docs.plus/commit/eefbb35de)).
- **History has a per-connection byte budget.** Each connection may receive about 20 MB of
  History replies per 10 s ([#214](https://github.com/docs-plus/docs.plus/issues/214)).
- **An erased account can no longer write back its profile, preferences or push devices.**
  Needs Supabase migration `20261024120000`
  ([#579](https://github.com/docs-plus/docs.plus/issues/579)).
- **New pgmq and storage objects no longer start open to anon and authenticated.**
  Needs Supabase migration `20261026120000`
  ([#570](https://github.com/docs-plus/docs.plus/issues/570)).
- **A crafted page can no longer block the server.** Our old page parser took 28 s on one
  crafted page. On one laptop, the new one took about 30 ms at worst on every crafted input we tried, up to 1 MiB ([#242](https://github.com/docs-plus/docs.plus/issues/242)).
- **One collaboration WebSocket message is capped at 16 MiB again.** Bun 1.4.4 raised the
  limit to 100 MiB, and a larger message now closes the socket with `1009`. Redeploy the backend
  ([#651](https://github.com/docs-plus/docs.plus/issues/651)).
- **Error reports no longer carry the `url` query value of a link preview request.** The webapp
  and the server filter it from `GET /api/metadata` and `GET /api/metadata/image` before they send
  a report. Server reports of the preview fetch keep only the host of the linked site, and the
  privacy page says so ([#242](https://github.com/docs-plus/docs.plus/issues/242)).

### Removed

- `get_bookmark_count` and `admin_get_user_notification_subs` are dropped. Nothing called
  them. Needs Supabase migration `20261025120000`
  ([#605](https://github.com/docs-plus/docs.plus/issues/605)).

### Documentation

- `README.md` is now two screens long. Its detail moved to `CONTRIBUTING.md` and `docs/`
  ([#541](https://github.com/docs-plus/docs.plus/issues/541)).
- The demo page at [docs.plus/demo](https://docs.plus/demo) has seven new pictures. They show the
  link icons, the hovercard, a pasted link taking its title, a card for a page that shares no
  preview, links into the same page, the share card, and media captions in Markdown. The page also
  says that a filter or a message link shows the page card.

### Internal

- Prisma is 7.10.1 ([#198](https://github.com/docs-plus/docs.plus/issues/198)).
- One shared package, `@docs.plus/pad-url`, builds every pad link in the webapp and the server,
  so both give the same answer ([#648](https://github.com/docs-plus/docs.plus/issues/648)).
- The App Performance dashboard plots the card chat read p95 on its own seconds axis. The
  deploy's Bun version check can no longer fail a deploy; it only warns.
- The `commit-msg` hook checks only the first line of a message, and caps it at 72 characters.
  Before, a body line that looked like a subject let a bad subject pass. The hook also rejects
  AI attribution, such as `Co-authored-by: Cursor`, and "Generated with" banners. A human
  co-author line still passes.
  [CONTRIBUTING.md](CONTRIBUTING.md) lists the rules.
- The `release-product` skill has a Benchmarks section. Every speed or reliability number is
  checked against its source and re-run where it runs locally. It then goes into the release
  note, the demo page and the changelog Highlights with the place it was measured.
- Each house skill has one copy, in `.agents/skills/<name>/`. `.cursor/skills/<name>` is a
  symlink to it, and `check:agent-docs` fails when it is not. Prettier now checks the house
  skills, which it had skipped.
- The root catalog holds `tailwindcss` and `@tailwindcss/postcss` at exactly 4.3.3. Tailwind
  4.3.4 writes a nested `@scope` rule that Lightning CSS rejects, so the webapp CSS failed to
  build with "Invalid empty selector". Lift the pin when a Tailwind release fixes it.
- CI runs Bun 1.4.4, the version the production images ship. Each deploy's run summary prints
  the image's Bun beside CI's, and warns when they differ
  ([#650](https://github.com/docs-plus/docs.plus/issues/650)).
- `apps/admin-dashboard` and the `packages/` folders that had none now keep their own
  `CHANGELOG.md`, with history back to 2.0.0 where the folder existed.
  [`RELEASE_POLICY.md`](RELEASE_POLICY.md) says which change goes where.

## [2.2.0] — 2026-10-22

**A release for AI apps and diagrams, and a security round for self-hosters.** The webapp and
hocuspocus share `2.2.0`. Admin stays `1.0.0`. Semantic Versioning would make this `3.0.0`.
It stays `2.2.0`, because the breaks touch only self-hoster config and API callers, and the
`2.x` pad product line is unchanged ([RELEASE_POLICY.md Status](RELEASE_POLICY.md#status)).

The six `@docs.plus/extension-*` packages publish `2.2.0` together.
`@docs.plus/extension-mermaid` is new, and this is its first publish. Each package's
`CHANGELOG.md` lists its changes.

### Highlights

- **Mermaid diagrams.** Write a ` ```mermaid ` block and see the diagram
  under it, in the pad and in History. [Pele](https://pele.run), the Mermaid
  renderer by Steph Ango ([@kepano](https://x.com/kepano)), draws it. The same engine ships as
  the new `@docs.plus/extension-mermaid` package ([#521](https://github.com/docs-plus/docs.plus/issues/521)).
  AI apps connected through the MCP connector can write diagrams too. The
  server checks each one before the write and refuses one that does not parse
  or is too large. The size limits are 10,000 characters and 250 edges. They
  were measured on a real iPhone and a real Android phone, so a large diagram
  never freezes a phone ([#522](https://github.com/docs-plus/docs.plus/issues/522)).
- **More AI apps, one page to start.** A public `/mcp` page gives the MCP
  server URL and the steps for each AI app. Settings › Connected apps adds a
  terminal agent grid for Claude Code, Codex, Copilot CLI and Cline. It also
  adds a setup prompt for any other agent, and Add to LM Studio and Add to
  Replit. Claude Code, Codex and Cursor now connect to production, and the
  consent page names Cursor ([#458](https://github.com/docs-plus/docs.plus/issues/458),
  [#548](https://github.com/docs-plus/docs.plus/issues/548),
  [#549](https://github.com/docs-plus/docs.plus/issues/549),
  [#550](https://github.com/docs-plus/docs.plus/issues/550)).
  Many people on one hosted AI app no longer share one rate limit
  ([#551](https://github.com/docs-plus/docs.plus/issues/551)).
- **Nobody misses chat because docs.plus thought they were online.** Some
  people showed as Online for good, so a plain chat message sent them no bell,
  push or email. Online now means a recent heartbeat, and nobody is stuck
  ([#489](https://github.com/docs-plus/docs.plus/issues/489),
  [#490](https://github.com/docs-plus/docs.plus/issues/490)). A chat email is
  skipped when you already read the message in the chat
  ([#497](https://github.com/docs-plus/docs.plus/issues/497)).
- **Safer by default.** Supabase grants are closed on helper functions,
  self-gated RPCs, anon tables and new partitions
  ([#469](https://github.com/docs-plus/docs.plus/issues/469),
  [#470](https://github.com/docs-plus/docs.plus/issues/470),
  [#318](https://github.com/docs-plus/docs.plus/issues/318),
  [#315](https://github.com/docs-plus/docs.plus/issues/315)). New tables and
  functions start closed ([#316](https://github.com/docs-plus/docs.plus/issues/316)).
  Restore now takes the same per-document lock as content writes
  ([047cc0b34](https://github.com/docs-plus/docs.plus/commit/047cc0b34)).
  A Private document's images now load only for its owner
  ([#439](https://github.com/docs-plus/docs.plus/issues/439)).
- **Extensions 2.2.0.** All six `@docs.plus/extension-*` packages ship `2.2.0` together.
  Changed lists what each package brings.

### Breaking

- Set `REDIS_PASSWORD`, or the stack does not start
  ([#438](https://github.com/docs-plus/docs.plus/issues/438)).
- Set `MEDIA_COOKIE_SECRET`, or nobody can load a Private document's images
  ([#439](https://github.com/docs-plus/docs.plus/issues/439)).
- With the bundled Traefik, edit the `Host` in the new `rest-api-wellknown` rule
  in `docker-compose.prod.yml`. With your own proxy, route
  `/.well-known/oauth-protected-resource` to `rest-api`
  ([#550](https://github.com/docs-plus/docs.plus/issues/550)).
- New Supabase tables, sequences and functions start closed. A custom migration
  must grant its own objects ([#316](https://github.com/docs-plus/docs.plus/issues/316)).
- Open Supabase grants are revoked. A caller that uses the anon key or
  PostgREST directly may lose access
  ([#469](https://github.com/docs-plus/docs.plus/issues/469),
  [#470](https://github.com/docs-plus/docs.plus/issues/470),
  [#318](https://github.com/docs-plus/docs.plus/issues/318)).
- `create_direct_message_channel`, the `pg_net` extension, four `public`
  functions and the `PushSentLog` table are dropped
  ([#319](https://github.com/docs-plus/docs.plus/issues/319),
  [#320](https://github.com/docs-plus/docs.plus/issues/320),
  [#321](https://github.com/docs-plus/docs.plus/issues/321)).
- The MCP read tools return text only, with no `structuredContent`
  ([#456](https://github.com/docs-plus/docs.plus/issues/456),
  [#457](https://github.com/docs-plus/docs.plus/issues/457)).
- `/mcp` is now a reserved slug
  ([#458](https://github.com/docs-plus/docs.plus/issues/458)).

### Migration

**If you self-host.** Read the [hocuspocus 2.2.0 Migration](apps/hocuspocus.server/CHANGELOG.md#220--2026-10-22)
before you deploy, and follow its order. Set `REDIS_PASSWORD` (32 characters or more) in
`.env.production`, and in `.env.observability` if you run the observability stack. Set
`MEDIA_COOKIE_SECRET` (32 characters or more) in `.env.production`. Edit the
`rest-api-wellknown` `Host` line, or route the well-known path in your own proxy. Run
`packages/supabase/scripts/check-grants.sql` before and after the 14 new Supabase
migrations. After them it should return no rows.

**If you use the npm extensions.** The five existing packages need no change. To draw
diagrams, add `@docs.plus/extension-mermaid`. Its `CHANGELOG.md` has the details.

### Changed

- **Extensions 2.2.0.** The six npm packages share one version.
  - [`extension-mermaid`](extensions/extension-mermaid/CHANGELOG.md): new. It draws a
    Mermaid code block as a live diagram, with Pele
    ([#521](https://github.com/docs-plus/docs.plus/issues/521)).
  - [`extension-hyperlink`](extensions/extension-hyperlink/CHANGELOG.md),
    [`extension-hypermultimedia`](extensions/extension-hypermultimedia/CHANGELOG.md),
    [`extension-indent`](extensions/extension-indent/CHANGELOG.md),
    [`extension-inline-code`](extensions/extension-inline-code/CHANGELOG.md) and
    [`extension-placeholder`](extensions/extension-placeholder/CHANGELOG.md): no behaviour
    change. They move to `2.2.0` with the family. Their READMEs link the new Discord invite
    ([#480](https://github.com/docs-plus/docs.plus/issues/480)). The hyperlink,
    hypermultimedia and inline-code docs now match the 2.x code
    ([#485](https://github.com/docs-plus/docs.plus/issues/485)).

### Fixed

- **Small things in the pad and Settings work better.**
  - Add link (Mod-K) with no selection inserts the URL you typed
    ([1dac1cf64](https://github.com/docs-plus/docs.plus/commit/1dac1cf64)).
  - URLs and commands on `/mcp` and in Connected apps show in a monospace face
    ([ebdc6cd47](https://github.com/docs-plus/docs.plus/commit/ebdc6cd47)).
  - Your online status stays right when you switch tabs or reload
    ([#492](https://github.com/docs-plus/docs.plus/issues/492)).
  - The @ picker and the avatars agree on who is online
    ([#493](https://github.com/docs-plus/docs.plus/issues/493)).
  - The Discord links work again ([#480](https://github.com/docs-plus/docs.plus/issues/480)).
  - The Codex setup command opens one sign-in, not two
    ([5af33da38](https://github.com/docs-plus/docs.plus/commit/5af33da38)).
- The full-Docker dev stack works. It mounts the webapp source, starts the backend
  and admin containers, and reaches the host Supabase on Linux
  ([#482](https://github.com/docs-plus/docs.plus/issues/482)).

### Internal

- Register `extension-mermaid` as the sixth family package
  ([#527](https://github.com/docs-plus/docs.plus/issues/527)).
- Make the generated Supabase types reproducible. A failed run never empties
  `supabase.ts`, and two runs on an unchanged database give the same file
  ([#498](https://github.com/docs-plus/docs.plus/issues/498)).
- Check Supabase script parity and grant allowlists in `check:ci`. One check
  fails when a function in `scripts/` differs from its newest migration.
  Another fails when copies of a role allowlist disagree
  ([92ec0aebb](https://github.com/docs-plus/docs.plus/commit/92ec0aebb)).

## [2.1.0] — 2026-10-13

**A feature release for writers, and an email change for self-hosters.** The webapp and
hocuspocus share `2.1.0`. Admin stays `1.0.0`. Semantic Versioning would make this `3.0.0`.
It stays `2.1.0`, because the breaks touch only self-hoster config and API routes, and the
`2.x` pad product line is unchanged ([RELEASE_POLICY.md Status](RELEASE_POLICY.md#status)).

The five `@docs.plus/extension-*` packages publish `2.1.0` together. It is their first
lockstep family release; each package's `CHANGELOG.md` lists its changes.

### Highlights

- **AI apps.** Connect Claude, ChatGPT or another AI app through the docs.plus MCP
  connector. It reads what you can open, and it edits only the documents you own.
- **Change digest.** Turn on email and follow a document, and get an email when other people
  edit it. The email marks added and removed words under each changed heading.
- **Write, find and share faster.** Type `/` to insert a block, and press ⌘+⇧+K to jump.
  Press ⌘+F for a floating Find bar with a match count. Share with the Share card's QR
  code and Present view, and pin favorites in the Documents list.
- **A calmer, clearer UI.** Cards, dialogs, menus and phone sheets share one look.
  Headings follow one size scale, and loading screens match the page they turn into.
- **Security round.** Private chat, chat write rules, files in Trash, server error text and
  deploy secrets are all tighter.
- **Extensions 2.1.0.** All five `@docs.plus/extension-*` packages ship `2.1.0` together, as
  one tested family. Changed lists what each package brings.

### Breaking

- Set `EMAIL_PROVIDER` (`resend` or `smtp`) and `EMAIL_FROM` to send mail
  ([#419](https://github.com/docs-plus/docs.plus/issues/419)). A provider key without
  `EMAIL_PROVIDER` now holds all mail. With no provider key, email is off.
- SendGrid is removed. Use the SendGrid SMTP relay with `EMAIL_PROVIDER=smtp`.
- Both deploy workflows stop when `EMAIL_PROVIDER`, `EMAIL_FROM`,
  `EMAIL_UNSUBSCRIBE_SECRET` or `PUBLIC_RESTAPI_URL` is empty in the host env file.
- `GET /api/email/health` returns only `status` and `queue_connected`
  ([#423](https://github.com/docs-plus/docs.plus/issues/423)). Admins read the rest on
  `GET /api/admin/email/setup`.
- Owner and author profiles no longer carry `status`
  ([#434](https://github.com/docs-plus/docs.plus/issues/434)). See Security.
- `GET /health/push` is removed and answers 404
  ([#433](https://github.com/docs-plus/docs.plus/issues/433)). See Security.

### Migration

**If you self-host.** Read the [hocuspocus 2.1.0 Migration](apps/hocuspocus.server/CHANGELOG.md#210--2026-10-13)
before you deploy, and follow its order. Set `EMAIL_PROVIDER` and `EMAIL_FROM`, or mail does
not send. Set `EMAIL_UNSUBSCRIBE_SECRET` to at least 32 characters, or unsubscribe links do
not work. Apply two Supabase migrations later than the others:
`20261009120500_hide_user_presence_columns` and `20261009130100_narrow_channel_insert_grant`.
The Migration says when. Until `apps/hocuspocus.server/scripts/backfill-document-access.ts`
runs with `--apply`, the chat of an existing Private document stays open. Run it without
`--apply` first to see the rows. If you store media on S3, set the existing objects private
after the server deploys. Turn on the Custom Access Token hook in the Supabase dashboard.
It is off until you turn it on, and it refuses a token for a password sign-in. It is
step 10 of the Migration. Keep **Confirm email** on, or a new person's first email-link
sign-in fails. Then compare `.env.example` with your env file.

**If you use the npm extensions.** Raise `@tiptap/core` and `@tiptap/pm` to `^3.31.3` or
later. In hyperlink, a `class` on a single link no longer renders; use the
`HTMLAttributes.class` option instead. In hypermultimedia, move a selector or test on
`[aria-pressed]` in the `…` menu to `[aria-checked]`. Each package's `CHANGELOG.md` has the
details.

### Added

- Share a document with a QR code. The share card shows the code beside the
  link, so a phone opens the document with one scan. Click the code for a
  full-screen Present view sized for a projector. It shows the code, the
  document title and the link in large text. A button next to Close switches
  the view to a dark background for a dark room, and dims the code's white
  plate to light grey. The app theme does not change.
  A private document shows no code. The card shares a clean document link,
  with no heading, chat or Filter state from the address bar. Its access line
  says "Anyone with the link can edit" unless the document is Read-only, and
  the owner sees Change next to it. On a desktop, a toolbar toggle after
  Filter also shows the code in a small card at the top right of the pad.
  Drag the card's corner to size the code from 128 px to 1024 px. A reload or
  another document hides the card
  ([#377](https://github.com/docs-plus/docs.plus/issues/377)).

- Connect an AI app to docs.plus through the MCP connector. Claude, ChatGPT,
  Claude Code, Codex and other MCP apps sign in as you on a consent page. The
  page trusts an app by its return address, never by its name.
  The app can read the documents and chat you can open. It can create a
  document, which is yours and public. It edits and posts only in documents
  you own. It never changes a section's heading, and it never removes media.
  Settings → Connected apps shows the server status, setup steps for each app,
  and the apps with access. Disconnect removes an app. Settings → Security
  says how many apps have access, and the privacy page says what an app
  receives. History shows a "Connected app" badge on a version that an app
  wrote. The admin dashboard counts tool calls on its MCP Usage page. A
  self-hoster sets `MCP_AUTH_ISSUER`; see [docs/mcp](docs/mcp).

- Find text in the open document. On a desktop, ⌘+F (Ctrl+F) opens a small
  floating Find bar at the top right of the pad. It shows a count such as
  "3 of 12", up to 9,999 matches, with Previous and Next buttons. ⌘+G, ⌘+⇧+G
  and F3 step through the matches, and Escape closes the bar. Find opens a
  folded section to show a match, and folds it again when you move on. A
  short selection fills in the query. On a phone, Find is a docked row, and
  the outline drawer offers it too
  ([#393](https://github.com/docs-plus/docs.plus/issues/393)).

- Type `/` on an empty line to insert a block. The list offers Heading 1 to 6,
  Subtitle, Normal, Bullet list, Ordered list, Task list, Blockquote, Code block, Picture and Link
  to a section. Type after the `/` to filter it. It does not open in the
  title, in a code block, or in a document you cannot edit. On a phone, it
  opens as a sheet.

- Press ⌘+⇧+K (Ctrl+Shift+K) to jump to a place or a document. The rows depend on the
  page. Home and every document offer New document and Demo. An open document adds History,
  Filter and Find in document. When you are signed in, the list adds
  Notifications on a document, the Settings tabs and the documents you own, newest opened first. Type to
  filter the list.

- See your unread notification count on the installed app's icon, where the
  browser supports it. Share a Word or Markdown file to docs.plus from another
  app, and it becomes a new document you own. Home now has an Install app
  button. An export opens the browser's save picker where one exists, and the
  share sheet on iOS. The installed app on iOS opens on a launch screen. The
  status chip warns "No offline copy" when the browser stops saving the local
  copy of the document.

- Sync your settings across your tabs and devices. A setting you save shows in
  every open tab and on every device where you are signed in. A field you are
  still editing keeps your change. The theme stays per browser.

- See the documents you joined in Settings → Documents. One list shows the
  documents you own and the ones you opened while signed in. A menu picks
  All documents, Owned by me or Joined. A document you do not own names its
  owner, and its ⋮ menu offers only Open in new tab and Copy link. Home shows
  the same list, with the first 8 rows and See all
  ([#390](https://github.com/docs-plus/docs.plus/issues/390)).

- Report a document from Settings. While a document is open, Settings shows
  Report a problem after Report an issue. It opens a mail to the contact
  address that the legal pages publish. The mail holds only the document link
  and the kind of report. Home does not show the row.

- Skip to the document from the keyboard. Skip to main content now leads into
  the pad. Most phone sheets and the outline and History drawers keep keyboard
  focus inside while they are open. Escape closes them, and focus goes back to
  the control that opened them.

- Play chat audio in a themed player, with seek and 1×, 1.5×, or 2× speed. A
  voice note sent from now on shows its waveform and length before you press
  play. Starting one clip pauses the others.

- Show what a chat member is doing besides typing. A small smile on their
  avatar means they are choosing an emoji, and a mic means they are recording
  a voice note. The chip shows in the chat header and on the heading's row in
  the table of contents. It bounces for about five seconds and then rests.
  With reduced motion it stays still. A face shows one thing at a time, so
  the typing bounce stops while a chip shows. Reactions do not show a chip.

- Show a Pad title rename in History and in workspace chat. After a signed-in
  rename, chat shows who changed it and the old and new titles. History paints
  the latest live notice above the editor and uses the snapshot username. Chat
  paints the live username, or the snapshot username until the live one
  arrives. A rename from Settings → Documents updates the
  open pad header and the room when that document is open. A rename does not
  mint a History version. There is no email and no bell for this notice.

- Favorite owned documents from Settings → Documents. The ⋮ menu lists Favorite or
  Unfavorite after Duplicate, before Private. Favorited documents sit at the top of the
  list and the grid. The chosen sort still orders inside each group. A gold star mark
  shows the state on the row and the tile while the menu is closed. There is no toolbar
  star. Soft-delete keeps the mark, so a restored document stays favorited. Trash does
  not list Favorites. A Favorite change finishes even when the menu closes before the
  server answers.
- Keep playable media and picture size on Markdown replace. Settings → Import &
  export turns a lone video, audio, or embed URL into a player, and writes each
  picture's natural width and height. A labeled link and a filter link stay links.
  Paste of a bare file address is unchanged.
- See the first page of each document on its grid tile in Settings →
  Documents, so you know a document before you open it. An empty document
  shows “Empty document”. List and Trash rows keep the document icon.
- Sort Settings → Documents by Last opened. Opening an owned pad stamps Last
  opened. Last modified does not move. A document never opened shows
  “Never opened”. A copy from Duplicate has never been opened, so it sorts at
  the end.
- Group the rest of the list and the grid with date headers: Today, Yesterday,
  Previous 7 days, Previous 30 days, and Earlier. Favorites stay at the top,
  above a thin line, with no date header. Title sorts stay a flat list. In the
  Last opened sort, a document you never opened sits under Never opened.
- Drag the desktop table of contents narrow to fold it into the tick rail, a
  32px map of the headings. Docked chat then spans the full width of the pad.
  Hover or focus a tick to preview its section, and click it to jump there.
  The rail hides headings inside a folded section. The button at the top of
  the rail opens the full table again at its last width. A refresh also opens
  the full table.
- Get a change digest email when other people edit a document you follow. You
  follow a document when you open it while signed in. The mail comes only
  when Enable email notifications is on in Settings → Notifications. Turn Follow off in
  Document settings to stop that mail. The owner of a Private or Read-only
  document does not see Follow, because nobody else can edit that document.
  The mail is a document sheet on a gray well. The mark and the title open
  the document. A bell shows the unread count and opens the notification list
  on that document. Under each changed heading, chats sit first, then the
  passage. A chat with no text reads "media". Added words are green, and
  removed words are red and struck through. A chat that is not under a
  heading stays as its own row. Headings with no change stay out. An added
  heading is washed green, and a removed one is red and struck through. A
  heading can carry a small grey label: Moved, Edited, or Heading level
  changed. A heading with no name reads "Untitled heading". When the mail
  cannot show the edits, it says that the document changed. The bottom bar
  names when the document changed, and offers Manage preferences and
  Unsubscribe. It reads "Changed since you left", with how long ago. Last left is the
  last time you were reading that document. Without a usable Last left, it
  reads "Changed in the last day" or "Changed in the last week", or names a
  start date.
  A plain-text mail marks removed words `[-like this-]` and added
  words `{+like this+}`. Like the HTML mail, it shows up to 5 messages per
  channel and 80 characters of each. You get no mail for edits you saw live:
  the server skips a reader whose tab still shows the document. Last left
  moves only while that tab is in view. Each document gets its own mail by default. In
  Admin Notifications, an admin can send one combined mail instead and set the
  HTML size limit from 10 to 102 KB. The default is 90 KB. In the
  notification list, View on a document change opens History with compare
  already painted. Compare runs from Last left to the newest version.
- Name how many people contributed in the digest email, under the changed-since
  line. The count covers the same window as the sections beneath it. It is a
  floor, not a head count, and it is left out when nobody is named.
- Check the email setup from the admin dashboard. The new Email setup page
  names each problem, and shows each secret only as set or missing. It runs a
  live connection check, and shows the newest bounce and the email dead-letter
  queue. Send test email sends one mail to your own address, at most once a
  minute
  ([#423](https://github.com/docs-plus/docs.plus/issues/423)).
- Turn email off for a reader whose mail bounces or who reports it as spam.
  When `RESEND_WEBHOOK_SECRET` is set, Resend reports delivery events to the
  server. A permanent bounce, a complaint or a suppression turns that person's
  email off
  ([#422](https://github.com/docs-plus/docs.plus/issues/422)).
- Fill in your profile from your own card. Your empty card still says "No bio
  or links yet.", and now offers Add bio and links, which opens Settings on
  Profile. Another person's empty card stays a plain line
  ([#307](https://github.com/docs-plus/docs.plus/issues/307)).
- Show an error card with Try again when a part of the page fails to load. It
  used to stay a skeleton forever. The first press tries again in place, and a
  second press reloads the page. The Settings sections and both QR codes use
  it.
- Send new accounts a branded Confirm signup mail. It used to be a bare link
  that a mail provider filed as spam. The sign-in and change-email mails now
  state the real link expiry, 1 hour, not 15 minutes. An operator pastes these
  templates into the Supabase dashboard by hand
  ([#425](https://github.com/docs-plus/docs.plus/issues/425)).
- Ask what changed in a document, per heading, between two times with
  `GET /api/documents/:documentId/changes`. It is service-role only. It reads
  only, and it loads no live document.

### Changed

- **Extensions 2.1.0.** The five npm packages share one version for the first time. Each
  README is now a short start page with an **Open in StackBlitz** example, and the full
  reference moved to `docs/` pages.
  - [`extension-hyperlink`](extensions/extension-hyperlink/CHANGELOG.md): text typed at a
    link edge stays plain ([#374](https://github.com/docs-plus/docs.plus/issues/374)).
    Pasted or loaded HTML can no longer style a link
    ([#399](https://github.com/docs-plus/docs.plus/issues/399)).
  - [`extension-hypermultimedia`](extensions/extension-hypermultimedia/CHANGELOG.md): a
    corner drag keeps the aspect ratio. One key press never deletes media
    ([#376](https://github.com/docs-plus/docs.plus/issues/376)). The `…` menu works from the
    keyboard, and hosts can import `isSafeMediaSrc`.
  - [`extension-inline-code`](extensions/extension-inline-code/CHANGELOG.md): the package
    loads on Safari and iOS Safari before 16.4.
  - [`extension-indent`](extensions/extension-indent/CHANGELOG.md) and
    [`extension-placeholder`](extensions/extension-placeholder/CHANGELOG.md): no behavior
    change. They move to `2.1.0` with the family.
- Send a voice note when you let go of the mic on a phone. It sends by itself
  only when the composer holds nothing else; otherwise it waits for your Send.
  A hold under one second sends nothing and shows how to record. While you
  hold, a lock rises above the mic and Slide to cancel follows your finger.
  Android phones buzz when the note starts, locks, or is ready to cancel. After
  a lock, Stop opens a preview with Send and Discard.

- Give the app one calmer, consistent look. Sign-in, app consent, access gates
  and error pages share one card, with a clear title and one main action. Every
  confirmation uses one dialog, with Cancel first and the action last. Dialogs,
  menus and phone sheets look and behave the same. Labels, hints and links have
  stronger contrast in every theme. Emails are easier to read, and the admin
  dashboard theme matches the app.

- **Reading and writing feel cleaner.**
  - Headings of one level in a section share one size, from 24pt down to 14pt. The smallest heading no
    longer looks like body text ([#367](https://github.com/docs-plus/docs.plus/issues/367), [#369](https://github.com/docs-plus/docs.plus/issues/369)).
  - Two plain paragraphs sit closer, so short lines under a heading read as one block
    ([#370](https://github.com/docs-plus/docs.plus/issues/370)).
  - An empty line's hint shows only its heading chain, in one grey with 4.5:1 contrast
    ([#371](https://github.com/docs-plus/docs.plus/issues/371)).
  - The heading chat button shows while the pointer is over its section
    ([#372](https://github.com/docs-plus/docs.plus/issues/372)).
  - Outline rows of one heading level line up. The phone outline spans the full drawer,
    and screen readers name an empty heading by its level
    ([#373](https://github.com/docs-plus/docs.plus/issues/373)).
  - Clear formatting removes text styles only. It keeps headings, Block style and links
    ([#392](https://github.com/docs-plus/docs.plus/issues/392)).
  - Backspace or Delete on an empty line between two lists of the same type joins them
    ([#378](https://github.com/docs-plus/docs.plus/issues/378)).
  - The link form opens with the URL field focused, so the first letter lands there
    ([#366](https://github.com/docs-plus/docs.plus/issues/366)).
- **Every click menu works like the right-click menus** ([#391](https://github.com/docs-plus/docs.plus/issues/391)). The Documents ⋮
  menu has four clear groups, and Private and Read-only are check rows inside it.
  Shift+F10 or the Menu key on a focused row opens the outline and chat menus. Menu rows
  show a keyboard focus outline.
- **Loading screens match the page they turn into** ([#463](https://github.com/docs-plus/docs.plus/issues/463),
  [#464](https://github.com/docs-plus/docs.plus/issues/464)). The pad skeleton keeps its bones inside the sheet. Chat, panels and
  popovers share one skeleton look.

- Close the docked chat by dragging its top edge down, the way the table of
  contents folds into the tick rail. Let go below 160 px to close it. Let go
  between 160 and 320 px, and the panel returns to 320 px. The Close button
  stays.

- Fade the table of contents at an edge where more headings are out of view.
  On desktop only the bottom edge fades, so the sticky document title stays
  whole. The phone drawer fades both edges.

- Load History one page at a time. The sidebar lists the newest 50 versions,
  and Show older versions loads 50 more. While older versions remain, the
  count shows a plus, as in "50+ versions". A shared link to an older version
  loads older pages until it finds that version. If you open many versions in
  a few seconds, History asks you to wait a moment.

- Hide Restore in History from signed-out visitors and from readers who cannot
  edit the document. They can still read and compare every version. A visitor
  used to see Restore and then a sign-in message.

- Fade a copy control to a check when the copy works. The Share dialog, link
  previews, chat message menus, bookmarks, notifications, Settings →
  Documents, and History version links all fade. A menu that closes after a
  copy first waits for the check to show.

- Give chat message actions one set of names: Copy Link, Copy to Doc, Edit,
  and Delete. The right-click menu, the phone long-press menu, and the ⋯ menu
  match, and Edit sits above Delete in each. A message with files keeps Copy
  Link, where it used to say Share message link.

- Retry only an email failure that time can fix. A failed send is now
  transient, permanent or operator. Only a transient failure retries, for about
  15 minutes. The other two go to the dead-letter queue at once. A script
  replays the entries that are safe to send again. Without `--apply`, it only
  reports them
  ([#421](https://github.com/docs-plus/docs.plus/issues/421)).

- Name Resend as the email provider on the privacy page. A new section says
  where mail data goes. Resend keeps sent mail and its logs for 30 days
  ([#424](https://github.com/docs-plus/docs.plus/issues/424)).

- Send fewer cursor updates while people edit. Editors no longer resend an
  unchanged cursor, or send back a cursor they just received. At 40 clients,
  WebSocket CPU fell from 33% to 3% per replica.

- Ask a signed-out visitor to sign in before they paste or upload media,
  import or export. They used to get a failed request and an error toast.

- Queue a title or description that you save while offline. It sends when you
  are back online, and it updates the header even after the dialog closes.

- Simplify Settings. One Time zone field picks your zone, shown like
  "(UTC+03:30) Tehran", with a way back to this device's zone. The digest
  frequency setting names the zone that daily and weekly digests use. Trash and
  Apps with access show only when they hold something.

- Share a chat link through the phone or system share sheet. The chat Share
  button opens it where the device has one. Elsewhere it still copies the link.

- Buzz briefly on Android when a long-press opens a chat message menu.

- Hold the server steadier under load. The revert cooldown and the retention
  sweep now run across all replicas, and public media reads get their own rate
  limit ([#243](https://github.com/docs-plus/docs.plus/issues/243)). Supabase
  and storage calls time out instead of hanging. An awareness frame over
  64 KiB is refused. The hocuspocus CHANGELOG has the details.

- Give clearer REST answers. A content `PATCH` waits for its save, or answers
  `503` with `SAVE_NOT_CONFIRMED`; it never sends a false `200`
  ([#229](https://github.com/docs-plus/docs.plus/issues/229)). A validation
  `400` names each bad field. `POST /api/email/validate` is a public route on
  the API server ([#246](https://github.com/docs-plus/docs.plus/issues/246)).

### Fixed

- The admin dashboard works on your own hosts. Its Content Security Policy
  allowed only docs.plus and supabase.co hosts, so a self-hosted dashboard
  could not reach its API. It now also allows the hosts in
  `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_GLITCHTIP_DSN`, read at build time.
- Fix the email footer links. View All Notifications opens the document and its
  notifications panel. Manage preferences opens Settings on Notifications. Both
  used to open a blank document named after the link, because the app has no
  page at those addresses. Unsubscribe still works. The same fix reaches the
  Manage Preferences button on the unsubscribe page.
- Mark your first message in an empty chat as sent. It was saved at once, but
  it kept the clock icon until you reloaded the page.

- Keep a chat message you send while scrolled far up. The jump to the newest
  messages could drop it from the list. If that send then failed, its text was
  lost.

- Keep your chat draft and files across sends, replies, edits, and comments. A
  failed comment gives back its text, its mode, and its files. Ending a reply or
  a comment no longer deletes a file you just sent. A file that is still sending
  now stays with its message when you end a reply, an edit, or a comment, or
  press Escape. That message used to fail or show a broken tile. Sending a
  comment no longer deletes your saved draft. An edit or a comment that you
  start while an earlier send checks its files keeps its text. Switching
  between a reply and a comment removes the files you added for the one you
  leave.

- Let Escape close only what is on top. Closing the mention list, a link
  popover, or the media gallery no longer also cancels a reply, an edit, or a
  comment. Starting a voice note closes the emoji panel.

- Split a long chat message by the length the database stores. A piece no
  longer fails or holds no text. An edit that is too long is refused before it
  saves, and your text stays in the composer.

- Make slide up to lock, slide left to cancel, and the 5-minute limit work
  while you hold the mic on a phone. A composer style let the browser read a
  slide as a scroll, and that ended the hold. Cancel discards the note. Letting
  go while the browser asks for the microphone turns the microphone off. A
  second finger on the screen no longer moves or ends the hold. When a
  recording stops by itself, its timer and sound levels now stop too. If you
  let go before the first microphone prompt and then refuse it, an error now
  says so.

- Save a voice note recorded on an iPhone as `.m4a`. It was named `.webm`,
  though it holds MP4 audio.

- Show a file at once when you add it while three others upload, and count it
  toward the 10-file limit. It used to stay hidden until its upload started.

- Notify the right people when a chat message holds an @. A capital letter
  after a username no longer mentions a shorter name. An email address in a
  message no longer stops the alert to members on All notifications. Your own
  message never mentions you.

- Bounce the avatar of a chat member who is typing. The bounce was defined but
  never played, because another animation on the same face replaced it.

- Make the chat composer work with a keyboard, a screen reader, and touch. Each
  button's name matches its tooltip, and each format button says when it is on,
  on the phone grid too. The + menu, the mention list, and the emoji panel work
  from the keyboard. Small controls on a phone are 44 px targets.

- Make Copy Link in a chat message's ⋯ menu a real button. It now works from
  the keyboard, and a screen reader names it as a button.

- Fix smaller chat composer faults. A file over 10 MB is refused when you add
  it, unless it is a picture that can shrink. A file that cannot fit shows no
  Retry. A failed chat load shows the error, not a skeleton that never ends. An
  edit with nothing left shows the mic, not a Send that fails. Add link and Edit
  link put the cursor in the address field. Opening a comment focuses the right
  composer. Strikethrough survives a send, and the composer no longer offers a
  heading or a divider that a send removes. The first comment on a heading with
  no chat works for a user who joined late.

- Make a signed-in person the owner of a new document when they first click
  into it, type in it or open its chat. Owner controls show at once, with no
  reload. A signed-out person leaves the document open, so anyone can rename
  it. Typing in a document that already exists never makes you its owner.

- Keep a notification preference you change just before closing Settings. If you
  turned a toggle off and closed the panel within half a second, the change was lost
  without a message. The toggle came back on the next time you looked.

- Stop one document going missing from Settings → Documents after a delete. Pressing
  Load more asked the server for the wrong position, so a document was skipped until
  the page was reloaded.

- Close Settings when your session ends while it is open from the editor toolbar. It
  used to stay on screen as an empty shell that could not close itself. The other
  three places that open Settings already closed it.

- Show formatting edits in version compare. Bolding a word, changing a link's address, or
  moving a heading to another level painted no highlight at all. The reader saw an
  unchanged document, though the edit was really there. The diff now compares marks and
  attributes as well as words. A formatting-only edit gets an edge on the block rather than
  a background tint, because the words did not change.
- Stop version compare drawing an empty strikethrough. A formatting edit reports a change
  that holds no text, but the removed-text marker was drawn anyway. It told the reader a
  word had gone when none had.
- Keep a new, unsaved document at its address when you rename its Pad title on
  a phone, or save its description or tags. The server used to file it under
  the new title, so a reload at the same address lost it.
- Stop the docked chat panel losing 1 px each time you click its resize handle.
- Keep the colour of a saved highlight. The server stored it, but the pad
  dropped it.
- Deliver push notifications to Chrome, Android, Edge, Brave and Opera again.
  A server check read their push service address as private, so these
  browsers got no push from 2026-08-09
  ([#398](https://github.com/docs-plus/docs.plus/issues/398)).
- Turn push back on for a device the server switched off. The app saves the
  device again, at most once a day, when you open docs.plus signed in. An
  outage at the push service no longer switches devices off
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).
- Stop pushes for the old account after you sign out. Sign-out now removes
  this browser's push subscription first
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).
- Give every notification type a real title. A document change or an account
  notice no longer arrives as "New notification"
  ([#417](https://github.com/docs-plus/docs.plus/issues/417)).
- Stop a mail link scanner from unsubscribing a reader. The unsubscribe link
  now opens a confirm page, and only its Unsubscribe button changes your mail
  settings. A mail client's one-click unsubscribe still works
  ([#445](https://github.com/docs-plus/docs.plus/issues/445)).
- Notify the person that a picked chat mention names, even after a rename. A
  typed @name still notifies whoever holds that name now
  ([#415](https://github.com/docs-plus/docs.plus/issues/415)).
- Keep the faces on outline headings after someone leaves. They used to go
  blank. The header count no longer counts people who left.
- Open the chat message hover menu on the first pointer move. When a card slid
  under a still pointer, the menu stayed closed until the pointer left and came
  back.
- Close the old document's chat when you switch documents. Opening chat from a
  phone sheet now needs one Back press, not two.
- Open the exact chat message from a chat push or a notification row, even
  when the message is in another document.
- Mail the published contact address from Contact support. It used to open a
  public document named "support". An Enter that confirms an IME candidate no
  longer saves a rename.
- Refuse privacy, terms and c as a document name. These names open app pages,
  so a document with one of them had no working link.
- Refuse a Private or Read-only change while offline. It used to wait in a
  queue, so a closed tab lost it with no error. Duplicate and access changes in
  the Documents ⋮ menu now finish even when the menu closes before the server
  answers.
- Count account alerts in the bell as they arrive, such as a failed email
  delivery. Alerts with no chat channel were left out of the count.

### Security

- Close a Private document's chat to everyone but its owner
  ([#396](https://github.com/docs-plus/docs.plus/issues/396)).
- Stop document content from changing the page's styles
  ([#399](https://github.com/docs-plus/docs.plus/issues/399)).
- Stop a viewer from changing the Pad title that other people see. The pad
  reads the title from the server
  ([#406](https://github.com/docs-plus/docs.plus/issues/406)).
- Keep server error text out of responses. Outside development, a server
  error from the shared error handler says only "Internal server error".
  A handler that sets its own message keeps it
  ([#413](https://github.com/docs-plus/docs.plus/issues/413)).
- Keep database and Redis error text out of the REST health responses, and
  stop a Redis stall from taking every `/api` route down
  ([#405](https://github.com/docs-plus/docs.plus/issues/405)).
- Show a plain, fixed message on the sign-in error page. An expired or used
  sign-in link says so. Every other error shows one general message
  ([#411](https://github.com/docs-plus/docs.plus/issues/411)).
- Keep server secrets out of the webapp and admin containers. In
  `docker-compose.prod.yml` they no longer load the whole `.env.production`,
  only the keys they read
  ([#403](https://github.com/docs-plus/docs.plus/issues/403)).
- Tighten the chat and workspace write rules. A reply stays in its own
  channel, and Bookmarks list only messages you can still read. The
  service-role function revokes now live in a migration
  ([#397](https://github.com/docs-plus/docs.plus/issues/397),
  [#401](https://github.com/docs-plus/docs.plus/issues/401),
  [#409](https://github.com/docs-plus/docs.plus/issues/409),
  [#410](https://github.com/docs-plus/docs.plus/issues/410)).
- Stop a chat client from writing message fields that the server owns. A
  client can no longer set a message's order or time, move it to another
  channel, or post it as a system notice
  ([#400](https://github.com/docs-plus/docs.plus/issues/400)).
- Keep the database grant fix from 2026-09-28 in the repository, so a fresh
  install matches production. Guests and signed-in users can no longer read the
  analytics tables or call the admin, cron and notification helper functions.
  Monthly view tables now have row security on
  ([#314](https://github.com/docs-plus/docs.plus/issues/314)).
- Keep the access token out of the document page data. The offline cache
  keeps that data, so the next person on a shared device could read the token
  ([#429](https://github.com/docs-plus/docs.plus/issues/429)).
- Clear chat drafts on sign-out. A draft belongs to a chat, not to a person,
  so the next person on a shared browser could see unsent text. Sign-out also
  removes four old document keys from browser storage
  ([#444](https://github.com/docs-plus/docs.plus/issues/444)).
- Clear the text, files and comment quote of a chat message when it is
  deleted. Before, a signed-in account could still read a deleted message
  ([#435](https://github.com/docs-plus/docs.plus/issues/435)).
- Show guests only the chat files that a sent message uses. An upload that
  was never sent can no longer be listed with the public key
  ([#432](https://github.com/docs-plus/docs.plus/issues/432)).
- Give the monitoring containers less access. Alloy no longer mounts the Docker
  socket. It reads the Docker API through a proxy that allows only GET calls.
  node-exporter no longer sees the host Docker socket. The Postgres exporter can
  use `POSTGRES_EXPORTER_DSN`, the connection string for a read-only
  `pg_monitor` login, in place of the app database URL
  ([#443](https://github.com/docs-plus/docs.plus/issues/443)).
- Keep each heading chat inside its own document. A client could open, and
  post in, a chat that another document held. A copy of a document now starts
  with empty heading chats. A later database step also stops a client from
  choosing a new chat's id
  ([#402](https://github.com/docs-plus/docs.plus/issues/402)).
- Stop serving the files of a document in Trash. Restore serves them again.
  New uploads to S3 are private, so every read goes through the server
  ([#408](https://github.com/docs-plus/docs.plus/issues/408)).
- Refuse a document id that is not one plain name. A crafted id could delete
  another document's files on local storage
  ([#426](https://github.com/docs-plus/docs.plus/issues/426)).
- Close a signed-in live connection when its sign-in token expires. The app
  reconnects with a fresh token
  ([#430](https://github.com/docs-plus/docs.plus/issues/430)).
- Check a ghost account again just before an admin deletes it. Revoking admin
  access can no longer leave zero admins. A deleted account now loses its
  public name, photo, bio and links
  ([#412](https://github.com/docs-plus/docs.plus/issues/412),
  [#427](https://github.com/docs-plus/docs.plus/issues/427)).
- Stop profile photos in SVG. A public bucket shows an SVG as a page, and an
  SVG can carry script
  ([#431](https://github.com/docs-plus/docs.plus/issues/431)).
- Hide each person's online status and last-active time from other people.
  The webapp stops reading both now. The database change that removes access
  ships at least 24 hours later
  ([#434](https://github.com/docs-plus/docs.plus/issues/434)).
- Take the push gateway status off the public `/health/push` route. That route
  now answers 404. Admins read the push gateway status on
  `GET /api/admin/push/gateway`
  ([#433](https://github.com/docs-plus/docs.plus/issues/433)).
- Take a live chat message's avatar from the author's profile, not from
  presence, because any client can forge presence
  ([#428](https://github.com/docs-plus/docs.plus/issues/428)).
- Stop a pasted node or a chat row from crashing a document page
  ([#436](https://github.com/docs-plus/docs.plus/issues/436)).
- Make each new document link from a cryptographic random source
  ([#442](https://github.com/docs-plus/docs.plus/issues/442)).
- Run production deploys only from `main`. When the host `.env` sets
  `TRAEFIK_CONFIG_DIR`, Traefik reads a copy that the deploy writes, so a
  runner checkout no longer changes live routing
  ([#437](https://github.com/docs-plus/docs.plus/issues/437)).
- Keep signed-in replies out of the service worker cache. Chat, notification
  and profile rows no longer stay in the browser after sign-out.
- Keep a connected app's token inside the MCP server. The token cannot reach
  database tables, Storage or Realtime directly. An AI app asks only for
  openid, email and profile. Logs redact tokens at any depth.
- Log who made each admin write
  ([#404](https://github.com/docs-plus/docs.plus/issues/404)).
- Keep a purged document id gone. A later write no longer creates its row again
  ([#407](https://github.com/docs-plus/docs.plus/issues/407)).
- Publish the local and dev Postgres, Redis and app ports on loopback only.
  Production compose is unchanged
  ([#414](https://github.com/docs-plus/docs.plus/issues/414)).

### Removed

- Remove passkeys. Sign-in is Google or an email link. Settings → Security no longer
  lists passkeys. Local Auth has passkeys turned off.
- Remove the unused Elastic APM keys from `.env.example`. No code read them,
  and the `NEXT_PUBLIC_` prefix would put the secret token in the browser bundle
  ([#446](https://github.com/docs-plus/docs.plus/issues/446)).

### Documentation

- Bring the self-hosting, local setup, API and MCP pages in line with the
  code. Each claim was checked against the code, and a fresh-reader walk
  covered local setup and a private server. `docs/self-hosting/install.md`
  now installs from the newest release tag, adds an admin account, and upgrades with a backup
  first. `docs/self-hosting/README.md` gains backup and restore.
  `docs/self-hosting/configuration.md` gains Google sign-in, push
  notifications, build values, observability and Supabase sign-in mail.

## [2.0.1] — 2026-08-31

**A measurement release.** No new features and no user-facing change. This entry names
runtime, build and test work, plus two defects found while measuring. The webapp and
hocuspocus share `2.0.1`. Admin stays `1.0.0`.

### Changed

- Raise the Bun floor to `1.4.0` across `engines`, `bun-types`, and every document that
  names it. CI and production already ran `1.4.0`, so this makes the repository say what
  it runs.
- Cut the backend image by scoping its production install to the backend closure. It was
  installing the whole workspace, so it shipped two Next.js versions and four SWC binaries
  that the REST, WebSocket and worker processes never import.
- Stop stamping ownership with a recursive `chown` in the backend image. `COPY --chown`
  writes ownership as each layer is written, instead of storing a second copy of the tree.
- Stop the webapp runtime image inheriting the build toolchain. It carried a C++ compiler,
  `python3` and a second JavaScript runtime it never used.
- Declare per-deploy values below the install in the webapp and admin images, so a changing
  git hash no longer invalidates the dependency install on every build.
- Run the five clean-room extension suites concurrently in the local gate.

### Fixed

- Exit non-zero when a backend process crashes. All three entrypoints routed an uncaught
  exception into a shutdown whose success path exited `0`, so a crash reported success and
  nothing downstream reacted.
- Restore the webapp Cypress duration split. It never loaded its timings file, so the
  four-way split was balancing by file count rather than by recorded duration.
- Await real events instead of fixed sleeps in the worker integration test. The shutdown
  case slept two seconds and then asserted the exit code, so a correct process whose drain
  took longer failed the test.
- Make the `.dockerignore` secret patterns recursive. A root-anchored `*.pem` matched only
  the context root, so a nested key still reached the build context.

### Measured

Verified on the production host in deploy `33367037524`.

|                         | before  | after  |
| ----------------------- | ------- | ------ |
| Production Docker build | 997 s   | 683 s  |
| webapp image            | 727 MB  | 332 MB |
| backend image           | 5.67 GB | 961 MB |
| Backend test suite      | 7.9 s   | 3.1 s  |
| Extension test gate     | 209 s   | 88 s   |
| Full local CI gate      | 290 s   | 163 s  |

The build-cache work lands from the next deploy onward. This one was the first build with
the new layer structure, so only 2 of 165 steps could be cached.

## [2.0.0] — 2026-08-26

**First stable product tag after the Etherpad years and the `2.0.0-beta.*` line.** This entry names the live docs.plus pad. The five `@docs.plus/extension-*` packages already shipped `2.0.0` on 2026-08-11. webapp and hocuspocus share `2.0.0`. Admin stays `1.0.0`.

### Highlights

- **Heading Chatroom.** Open chat from a heading or the TOC. See unread on TOC rows and heading chips.
- **TOC.** The desktop TOC and the mobile TOC both show the outline and fold. Presence and drag are desktop only. Long titles wrap.
- **Document Version History.** List versions, compare two, and restore one. Share `#history?version=` links.
- **Private / Read-only.** Private is owner-only. Turning Private ON clears and disables Read-only.
- **Document conversion.** Import Word or Markdown. Export Word, Markdown, or OpenDocument. Print a PDF from the browser print dialog.
- **Chat media.** Attach up to 10 files. The Feed album tiles pictures and video in the message. Open the Gallery playlist to step through them. Media stays inside the column.

### Breaking

- Replace the Etherpad pad with the Next.js pad.
- Treat Private as owner-only. A signed-in stranger is denied. An anonymous visitor must sign in.
- Refuse Access mutation on an Open document. Locks move only when an owner exists.
- Flipping Private or Read-only no longer claims ownership.
- On an owned document, only the owner may change title, description, and keywords.
- Turn Private ON and the control clears and disables Read-only until the document is public again.
- Turn anonymous sign-in off. Local Auth matches production.

### Migration

**If you used Etherpad docs.plus.** Open your documents at [docs.plus](https://docs.plus). The editor is the Next.js pad. Etherpad plugins do not load.

**If you treated Private as any signed-in user.** Private now means only the owner may open the document. Sign in as the owner to change locks. An Open document has no owner, so it cannot turn Private.

**If you claimed an Open document by flipping Private first.** That path is gone. The server records a signed-in creator as the owner. A later lock flip never sets one.

**If you self-host.** `make dev-local` is the contributor path. Production needs Postgres, Supabase, S3, email, and DNS. The persist worker is required. See [Self-hosting](docs/self-hosting/README.md) and [hocuspocus CHANGELOG](apps/hocuspocus.server/CHANGELOG.md).

**If you consume the npm extensions.** They already shipped. Read each package `CHANGELOG.md`.

### Added

- Open or create a document from the home page. Type a name, or choose Create New Document.
- Visit `new.docs.plus` and land in a fresh document straight away. The same jump works at `/new`, which the installed app uses for its New Document shortcut. A one-time tip on a new document names that host.
- Edit a public pad with more than one person at once. On desktop, presence shows on the TOC and beside Title.
- Format pad text with Bold (⌘+B), Italic (⌘+I), Underline (⌘+U), Strikethrough (⌘+⇧+S), and Highlight (⌘+⇧+H). Press Ctrl in place of ⌘ on Windows and Linux. The buttons sit on the desktop toolbar, and in the mobile Text formatting panel while the keyboard is up.
- Add a Bullet List, an Ordered List, or a Task List from the desktop Lists menu. The mobile Text formatting panel offers the same three lists. A blockquote button sits on the desktop toolbar only.
- Add a code block, or mark inline code, from the Code menu on the desktop toolbar. The mobile toolbar has no Code menu, so type instead: three backticks start a block, and backticks around text make a span. ⌘+E, or Ctrl+E, toggles the span. The block highlights syntax for the nine languages it detects, and the pad has no language picker.
- Clear Formatting strips every mark from selected text, hyperlinks and inline code included. With nothing selected it clears block formatting instead and leaves marks in place.
- Add the Block style picker: Normal text, Subtitle, and Heading 1 to Heading 6. Title is not a choice. It is the locked first line, and the picker reads Document title there.
- Step Block style on mobile with a one-frame control: name, then minus and plus.
- Size headings with HeadingScale by section rank. HeadingScale is automatic, not a user font-size control.
- Indent paragraphs and headings with Tab. Outdent with Shift-Tab. Inside a list, Tab nests the item instead.
- An empty top-level paragraph or heading shows a breadcrumb of its parent headings, for example `Install > Docker > Heading 3`. Only the block holding the caret shows one. The first line reads `Enter document name`. A block inside a list or a quote keeps a short label, and an empty code block reads `Write code`.
- The mobile pad opens in read mode. Tap the round pencil button, or double-tap the text, to start typing. Closing the keyboard returns the pad to read mode. The pencil button hides while the Chat pane is open, and neither path unlocks a Read-only document.
- Open the Text formatting panel from the mobile pad toolbar. That toolbar appears only while the on-screen keyboard is open, so tap the pencil button first.
- Convert pasted Markdown into pad blocks. Paste a media URL to embed. Paste an image to upload.
- Copy the whole pad to the clipboard from Copy Document in the desktop toolbar. It writes rich text and plain text. Where the rich write is not available, the fallback copies plain text only.
- Insert pad media from Embed URL or Upload: Picture, Video, Audio, YouTube, Vimeo, SoundCloud, Spotify, Loom, and X.
- The Upload tab takes a file up to 10MB. Sign in first: an anonymous editor gets an `Authentication required` message. A placeholder holds the spot while the file uploads, and Cancel stops it. docs.plus refuses a larger file with a message before any upload starts.
- Set a caption on pad media. Choose Left, Center, Right, Wrap left, or Wrap right. Margin only changes the gap when text wraps.
- The desktop media toolbar hides Margin unless the media wraps, and keeps Replace URL, Copy, and Delete in an overflow menu. Download covers Picture, Video, and Audio only. Mobile opens a layout sheet with no Replace URL.
- Create, preview, and edit hyperlinks on the pad. Open the link box with ⌘+K on macOS, or Ctrl+K elsewhere. In the box, pick a heading from this document. Sign in and the box also lists your Bookmarks, the chat messages you saved in this document. The preview shows the page title with a favicon or preview image, and falls back to the raw URL.
- Click a link that points into the current document, then pick the destination in the link preview. It scrolls to the top or a heading, opens the Heading Chatroom, applies a filter, or opens Document Version History. A link inside a chat message runs on the click itself.
- Deep-link headings with Heading slug trail (`?h=` ancestry) and the `id=` resolver.
- The desktop TOC marks the heading you are reading and scrolls that row into view. The mobile TOC is a drawer, and it opens at that row.
- Open the mobile TOC drawer from the menu button in the pad title bar. Its footer opens Filter and Document settings, plus Bookmarks when you are signed in.
- Drag a desktop TOC row to move its whole section. Drag it sideways to change its heading level. Level chips on the row show the levels you can reach: up to three steps each way, inside H1 to H6.
- Right-click a desktop TOC heading row for Chat Room, Fold Section, Focus Section, Copy link, and Delete Section.
- Focus Section filters the document to that one section. Delete Section removes the heading, its text, and its sub-headings, after a confirm dialog.
- Fold a section from the TOC chevron, shown only on a heading that has sub-headings. The pad collapses the text to paper strips. Click a strip to unfold. Each fold is stored in your own browser, so readers do not share folds.
- Filter sections from Filter with typeahead, chips, Reset, and Match all. Filter terms stay in the URL path.
- Append a Heading 1 at the document end from Add headings.
- Comment from a text selection on desktop only, in a heading or in body text. Comment from media on desktop and mobile. Comments open Heading Chatroom.
- Turn Read-only on and everyone except the owner stops typing on the pad. Document Version History always opens the pad read-only, and hides the heading chat and comment controls.
- Show a gate page when a private document will not open. It asks you to sign in, or it says only the owner may open it. When the server could not check at all, the page offers Try again instead.
- Read Heading Chatroom messages on a public document without signing in. To send or react, sign in and then choose Join Channel. Unread counts also need an account.
- Format a chat message with bold, italic, inline code, a link, lists, a quote, or a code block. Open Text formatting from the composer plus menu.
- Record voice into the attachment strip.
- Mention people and `@everyone` from the composer. Insert emoji from the composer panel.
- Open message actions from the desktop hover menu or a mobile long press. A long press also shows quick reactions, and a reaction needs a signed-in account. Signed-in members of that chat also get a desktop right-click menu.
- React to a chat message. Reply to any message. Edit or delete your own.
- Copy a message link with `?chatroom=` and `msg_id=`. Copy a message into the document.
- Reply in Thread turns a chat message into a new Heading and opens its chat.
- Bookmark a chat message from its hover, right-click, or long-press menu. You must sign in first. Open Bookmarks on the pad to find it again. The panel lists this document only.
- Open Notifications on the pad. It has Unread, Mentions, and Read tabs, and lists this document only. Mark all read clears both unread counts.
- Keep an unsent chat message per channel. The chat draft comes back when you reopen that chat in the same browser.
- Mark an image attachment as a spoiler before you send it. Only the desktop composer shows the toggle, and only for images.
- Reveal spoiler media with two taps before the gallery opens.
- Jump to the latest chat messages. Unread from the server and this session stack on one chip. Show peer read marks on own messages.
- Set a Heading Chatroom to All notifications, Mentions only, or Muted while you are signed in. One toolbar button cycles the three states and shows the current one as an icon. Muted still notifies you about replies and reactions to your own messages.
- Dock chat on desktop. Mount the mobile Chat pane with Pane mode `closed`, `half`, or `expanded`.
- Drag the Chat pane grabber to snap Pane mode. On a phone, the hardware back button closes the Chat pane, a sheet, or a drawer.
- Add Settings → Documents: search, sort, list or grid, Rename, Duplicate, and Trash restore or purge.
- Undo a document delete for six seconds. In Trash, each document counts down the days it has left. Select rows for bulk Restore or Delete forever, or clear everything with Empty trash.
- Add Settings → Profile: avatar, username, name, bio, and social links.
- Add Settings → Security. It shows the account email you signed up with, and email changes are not supported yet. Add, rename, and remove passkeys on the same page. The passkey card hides when the auth service has passkeys turned off.
- Open Settings as a full-screen mobile takeover. Confirm Sign out before the session ends.
- Add Settings → Notifications for push and email. Choose which events reach you: mentions, replies, or reactions. Each set appears only after its channel is on. Email frequency runs from Immediately to a Daily digest, a Weekly digest, or Never.
- Add Quiet Hours to Settings → Notifications, with a start time, an end time, and a timezone. It appears once push notifications are on. On iOS, push needs docs.plus on the Home Screen and iOS 16.4 or later.
- Stop docs.plus email from the link inside the message. `/unsubscribe` needs no sign-in, and a mail client can unsubscribe in one click. docs.plus also pauses your email after a bounce, and names the address that failed.
- Open a peer profile dialog from an avatar or a mention.
- Show the last account used on this browser when you sign in again. The form offers that person's avatar, name, email, and a `Continue as` button. Choose `Not you?` to forget the account. Signing out keeps it.
- Add `/privacy` and `/terms`, linked from the home footer.
- Serve `/sitemap.xml` and `/robots.txt`. Only the home page, `/privacy`, and `/terms` are listed. Every user document stays `noindex`.
- Share a docs.plus link and the preview shows a real card, not the square app icon. The home page also carries `Organization` structured data.
- Add Graphite and Paper themes beside Light, Dark, and High Contrast. System follows the base pair only.
- Cycle Light, Dark, and System from the desktop pad header while signed out. The full theme picker lives in Settings, which needs a sign-in.
- Install docs.plus as an app from the browser prompt. The installed app carries a New Document shortcut.
- Mirror every open document into IndexedDB as you type. Text written just before a reload survives it and re-syncs on reconnect. A document you have not opened in this browser cannot load offline.
- Show a banner on the pad when your sign-in ends while you edit. Sign in from the banner, or from the status chip. The document stays open. The banner says Session expired only when you were signed in before.
- Show a card in place of the document when the server cannot be reached before the document arrives. docs.plus keeps retrying, and the card clears itself once sync returns.
- Show who holds text in a version on the desktop Authors tab. None and Not recorded are common.

### Changed

- Lead sign-in with Continue with Google.
- Share one sign-in form across hosts. A phone opens it in a bottom sheet. A desktop opens it in a centered dialog.
- Run Continue with Google in a popup window, so the page you were on never reloads. A phone, or a blocked popup, falls back to a full-page redirect.
- A new document is public until an owner turns Private.
- On an Open document, anyone may retitle, signed in or not.
- Share Access mutation across Document settings and the Documents ⋮ menu. Confirm Private ON first.
- Hide Copy link once Private is on. Disable Read-only while Private is on.
- Turning Private ON live-seals the room and kicks non-owners.
- Soft-delete to Trash. The reaper purges after the retention window (default 30 days).
- Treat the pad status chip as local. Its icon changes 300 ms after your last edit. In that state the chip shows an icon and a tooltip, never a status word.
- Treat durable persist as the version row. The chip icon changes when the worker publishes `document:saved`. Its tooltip then reads `All changes saved`.
- Show a word on the pad status chip only when sync is not healthy. Connecting shows while the document loads. Offline, Error, Reload, and Sign in show when sync is in trouble. On mobile the chip stays hidden until then.
- Debounce durable store at 10 s idle, or 60 s while typing continues.
- Keep a local draft across reload until the worker writes the first version.
- Restore rewrites the shared live document for every connected editor.
- Thin unnamed autosave versions older than 30 days to one per day. A name you typed is kept. A machine backup is not, so a very old restore stops being undoable.
- Stage an import and show lossy-conversion warnings before Replace document.
- File exports use the last saved snapshot, not live unsaved keystrokes.
- Print only the document. Hide the pad shell. Browser Print / Save as PDF uses that page.
- Build heading share URLs with Heading slug trail to Title, not every prior heading.
- Size the Chat pane from the live pad shell, so its composer stays reachable in every Pane mode.
- The home page makes room only when the on-screen keyboard opens. Tapping the name field alone no longer shrinks it.
- A narrow desktop window keeps the desktop pad. Only a phone or a tablet gets the mobile pad.
- Fade between palettes when you change the theme. The fade is skipped on the mobile shell, on High Contrast, and under reduced motion.

### Fixed

- Clamp Feed album tiles to the measured column so chat media does not overflow.
- Move the pad caret to the tapped spot on iOS Safari, after the browser snaps it to a word boundary. The fix skips a tap on a hyperlink.
- Stop a link edit on a phone from crashing the pad.
- Close the emoji picker together with the chat reaction sheet. The picker used to stay open after the sheet closed.
- Seed a new document outside undo history so the first undo cannot empty the pad.
- Fix Filter on a phone. It used to do nothing.
- Close mobile sheets with the hardware back button instead of leaving the document.
- Recover a failed OAuth code exchange, clear the stale code, and prompt a retry.
- Re-ask the server after a sign-in on the private gate. The first answer was decided before that sign-in.
- Reopen the collaboration socket after a sign-in on an open document. The pad picks up the new scope without a page reload.
- Recover an open tab after a deploy removes the page asset it needs. docs.plus reloads the tab by itself, and stops after two tries in five minutes.
- Evict a thinned history version and open the newest row instead of looping.
- Put the mobile pad on iPad. Safari reports a Macintosh user-agent, so the shell used to stay on desktop.

### Removed

- Remove the Etherpad application from the docs.plus product.
- Remove anonymous sign-in.
- Remove the signed-in-user Private rule. A signed-in non-owner now sees You don’t have access to this document.
- Drop the mobile chat sheet. Mobile chat is the Chat pane only.

### Documentation

- Add reader docs under `docs/` for self-hosting, the API, and decision records.
- Point API callers at [`docs/api`](docs/api), [`apps/hocuspocus.server/API.md`](apps/hocuspocus.server/API.md), and [`apps/hocuspocus.server/CHANGELOG.md`](apps/hocuspocus.server/CHANGELOG.md).
- The OpenAPI page at `/docs` is not on the public edge.
- Document `make dev-local` as the contributor first-run path in `README.md` and `CONTRIBUTING.md`.
- Direct vulnerability reports to `security@docs.plus`. Do not open a public GitHub issue for one.
- Serve `/.well-known/security.txt`, so a reporter finds the address without opening the repository.
- Index the five npm extensions in `extensions/README.md`.

---

## Pre-`2.0` history

docs.plus reaches this tag through two code lines. They share no common ancestor.

**The Etherpad line, to 2022-09.** docs.plus `1.x` was an Etherpad fork. Its last tag is `v1.8.18`, dated 2022-09-07. That code is not reachable from `main`.

**A collaboration server, 2022-09 to 2023-03.** The current `main` starts on 2022-09-20 with a Vite client and a Hocuspocus server. Its first Prisma schema already named Postgres and a `Documents` table of snapshot bytes. Supabase arrived in 2023-01 and brought sign-in.

**The Next.js pad, 2023-04 to 2023-08.** A Next.js and Tiptap pad replaced the Vite client. The editor extensions moved into their own packages, starting with the hyperlink extension in 2023-05. The version string reached `2.0.0-beta.103` on 2023-08-03 and did not move again until this tag.

**Chat, 2024.** Messages, threads, reactions, and mentions landed from 2024-01. Chat then bound to headings. That is the Heading Chatroom in this release.

**The build-out, 2025 to 2026.** Document Version History got its own screen in 2025-02. The admin dashboard and web push notifications followed in 2026-01. The server gained its document content, conversion, and version modules in 2026-07.

**What the record does not show.** These years have no per-release history. `v2.0.0-alpha.103` is the only pre-release tag on GitHub, dated 2023-05-12. `2.0.0-beta.103` was a version string, never a tag. A generated changelog written in 2023 was deleted in 2025, and [`RELEASE_POLICY.md`](RELEASE_POLICY.md) forbids restoring it. Read the git log for anything finer.

---

[Unreleased]: https://github.com/docs-plus/docs.plus/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/docs-plus/docs.plus/releases/tag/v2.3.0
[2.2.0]: https://github.com/docs-plus/docs.plus/releases/tag/v2.2.0
[2.1.0]: https://github.com/docs-plus/docs.plus/releases/tag/v2.1.0
[2.0.1]: https://github.com/docs-plus/docs.plus/releases/tag/v2.0.1
[2.0.0]: https://github.com/docs-plus/docs.plus/releases/tag/v2.0.0
