# Section changes in heading chat

The design proposal for telling a returning member, inside a heading chat, that its Section changed. It does not describe shipped behaviour, and [research.md](research.md) holds its sources.

Status: Proposed, awaiting decisions · Date: 2026-10-02 · Discussion: [#101](https://github.com/docs-plus/docs.plus/discussions/101)

Section, Preamble, Last left, Anchor, Change window and Change digest mean what [`CONTEXT.md` §Document changes](../../../CONTEXT.md#document-changes) says. The [Names](#names) table defines the new terms.

## Verdict

Show Section changes in a heading chat as one derived line, not as chat messages. The line tells a returning signed-in member that someone else changed this Section while they were away, and roughly when. It reads "This section changed · 2 hours ago · View changes". View opens History at that Section. Chat stores nothing, and History stays the only record.

Build it in two parts:

1. History at a Section. History opens compare from Last left and paints one Section. It ships from the webapp alone, through "Show changes" in the desktop TOC row menu.
2. The Section change line. The worker writes a Section print on each version row it saves. One cheap read of those prints answers "did this Section change?" with no snapshot decode.

Four choices depart from the original ask:

- The line names nobody at launch. No data source can yet name who changed one Section honestly (Research, Trade-offs). Editor names are an open decision for the maintainer (decision 6).
- It is a line above the feed, not a message in it. Saves far outnumber messages. Trade-offs lists the structural obstacles to stored notice rows.
- It is personal, from the reader's own Last left, not shared. Visitors have no Last left, so a shared line would need a second clock.
- The line says that the Section changed, not what changed. View shows the words in History at a Section, which paints only this Section. An earlier maintainer ruling keeps History compare as the in-app paint (Rulings).

On a plain reading, the line conflicts with an earlier maintainer ruling: "Do not build a new 'since you left' panel". This RFC asks the maintainer to accept a scoped overturn. If the maintainer refuses it, the build is History at a Section only.

## Names

All names are provisional until the maintainer approves them. A flat Section ends at the next heading of any level, so it never holds its sub-headings. The first three join [`CONTEXT.md` §Document changes](../../../CONTEXT.md#document-changes) when they ship.

| Name                      | Meaning                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Section change line       | The one row above a heading chat's feed that reports a change to that Section.                                |
| History at a Section      | History compare limited to one Section, opened from the line or from "Show changes".                          |
| Section print             | A hash of one Section's normal form, stored per version row.                                                  |
| `Documents.sectionPrints` | The nullable jsonb column that holds a row's Section prints.                                                  |
| `history.section`         | The new read type on the WebSocket process.                                                                   |
| `arrivedAt`               | The instant the reader's current room connection opened.                                                      |
| `D`                       | The debounce and retry delay from an edit to its committed version row, about 100 s. Queue wait can add more. |
| `DOC_SECTION_CHANGE_LINE` | The env value that turns the read on or off.                                                                  |

## Problem

The original ask has two sources. Discussion #101 asked for document edit history in heading chats. The maintainer's 2026-10-01 ask is to show Section changes as system entries inside the heading chat. Its example is "Edward and Harvey updated this section". Each entry would carry a diff like History. The hard part is when, why and how such entries appear. Seven people editing one Section for ten minutes must not create dozens of entries or noisy rows. A returning reader should be able to answer four questions without reading dozens of system messages or opening the full History page: What changed? Who changed it? When did it happen? Is there anything important I need to respond to? The answer must stay almost invisible until it is useful.

What exists today:

- A returning follower gets at most one unread `content_change` notification per document per 24 hours. Its View opens a whole-document History compare from Last left.
- The Change digest places heading chats under their changed headings, but only in email.
- No in-app surface says which Section changed, and History cannot open at a Section.
- Nothing records when a Section changed. A per-Section answer today decodes two whole snapshots per window. On the 5.4 MB document, a chat open that decodes 20 History sessions peaked at 476 to 779 MB. That is near or above the 512M `rest-api` limit.

Four facts make the design hard:

- Saves far outnumber chat messages. A live demo in London had 494 saves and 3 messages on one document in one day.
- One bulk save can change many Sections. Locally, 2% of saves held 41% of all Section change events.
- Six ordinary actions give a heading a new toc-id and leave its chat with no heading.
- A Section change often has several authors or none, but a chat message must name a person who acted.

## Research

**Peers.** Most editors show change events on a read-only surface: a version panel, a catch-up view, an inbox or email. Among the editors studied, only Quip put edit records into its conversation. It added Hide Conversation in 2017, then a "Messages only" filter in 2021, after "too much action in the Conversation pane". No studied open-source peer posts content edits into a document's discussion. Mattermost Playbooks keeps chat for people and puts automatic events in a separate timeline. The closest analog is Slack's canvas update message. It is shared and stored, posts only for additive edits after five quiet minutes, and any member can mute it. GitHub pairs a shared timeline with a personal "Changes since last review" view. MediaWiki marks a page "updated since your last visit" and offers one diff from the first unseen revision.

**Literature.** A returning person first asks "Is anything different since I last looked at the work?" They want a light answer first, then detail on request (Tam and Greenberg, 2006). A rough time is more useful than an exact one. Readers care more about changes by others than by trusted co-authors (Neuwirth and others, 1992, as cited by Tam and Greenberg). Writers feel they own their sections (Larsen-Ledet and Korsgaard, 2019). They post in a group chat when they finish one. In asynchronous co-writing, more editing of a partner's text went with lower attraction to that partner (Birnholtz and others, 2013). So an automatic "X updated this section" line can read as public blame. Frequent bot posts make people stop reading team chat (Erlenhov and others, 2020). Events from fast producers are cheaper to compute at read time (Silberstein and others, 2010). Here, saves are the fast producer, and chat opens are the slow consumer.

**Measurements.** They come from a local development corpus on an Apple M5 Max. Compare ratios, not times.

- Decoding costs the most in any change check. `Y.applyUpdate` alone is 78 to 93% of each decode.
- Stored Section hash lists added 0.36% (64-bit, binary) to 1.3% (SHA-256, JSON) to snapshot bytes. Paired by toc-id, then by content, they matched the change engine's `diffSections` on 430 of 430 local version pairs. The change engine is the server code behind the Change digest that lists changed Sections.
- From two snapshots, a creator walk can name who created text in a Section, never who removed it. A complete list of names, with no removed text, was possible for only 24 to 29% of changed Sections.

[research.md](research.md) holds the sources, the measurements and how each measurement was taken.

## User expectations

- A light answer first: did anything I care about change while I was away? One more action shows the detail where the change happened.
- No instant alert for edits. Google Docs sends no edit email by default, and Confluence batches edits into a daily digest. docs.plus already mails edits through the Change digest.
- Changes by other people, not my own. A change I watched live needs no later signal.
- A name only when it is right. A wrong name, or a name shown to everyone, can read as blame in a co-writer's Section.
- Chat stays a conversation, also in the 230 px half-mode feed on a phone.
- For screen readers, a sentence and a button in reading order, with no surprise announcement.
- Chat looks the same for visitors.
- For operators, an off switch that needs no rebuild and no SQL.

## Proposed UX

### History at a Section

The desktop TOC row menu gains "Show changes" for signed-in members, with `Icons.history`, because every row in that menu has an icon. It opens History compare from the member's Last left and paints only this Section. History scrolls its own read-only editor to the heading once, with no animation. The live pad never scrolls. The phone TOC has no row menu, so phones get no way to open History at a Section until the line ships.

A status line sits under the History toolbar, outside the editor's scroll area. It names the Section and the window, and it states one result:

- "This section changed since you left."
- "This section did not change since you left."
- "Only its sub-headings changed since you left." Sub-headings are the rest of the nested range that Fold and Delete section use.
- "This section has no match in the version from when you left. History shows the whole document."
- "History cannot find this section in the latest saved version."

The status line says "since you left" only when the compare starts at Last left. Otherwise it names the start date. It ends with "The Versions list shows who saved anywhere in the document." It offers "Show the whole document", which paints today's compare. It takes focus once, and only when focus is on the page body.

A first visit keeps today's "No earlier visit to compare against." toast. While a Section is pending, a load failure shows one toast: "Could not load the changes for this section."

Every diff run in History compare gains visually hidden labels: "Added:" and "End added", "Removed:" and "End removed". Today a tint alone marks added text, so a screen reader cannot find where a change starts or ends.

### The Section change line

The line is one row under the heading chat header, above the pinned bar and outside the message list. No feed path, read cursor, unread count, badge or jump chip changes.

It shows to a signed-in member whose Last left is set, when someone else changed this Section while they were away (Trigger model). It reads "This section changed · 2 hours ago · View changes". When the read finds no time, the line leaves the time out. The time comes from History's `formatRelativeTime`, so chat and History use the same words. It moves into `@utils/formatTime`, which already exports `formatTimeAgo`. Merging the two formatters is its own change. Visitors, first visits and the workspace chat look as today.

The four questions:

- What changed: the line names the Section, and View shows the words.
- Who changed it: nobody at launch. The Versions list in History shows who saved.
- When: a rough time.
- Anything to answer: the unread divider, the new-messages banner, the jump chip and mentions answer it, unchanged.

No line means one of two things: nothing changed while the reader was away, or the read could not tell.

**Look.** The line reuses the pinned bar recipe (`border-base-300 bg-base-100 border-b`), with one native button across the row and `text-sm`. The sentence never truncates. The time and "View changes" wrap to the next line as whole pieces. On desktop the row is about 37 px tall. It adds no token, species, size, radius, shadow or ink step to the [design system](../../../.cursor/docs/design-system.md).

**Timing.** The chat asks once per open. The line appears only in the render that reveals the feed, so its arrival moves no message the reader can see. A late answer shows nothing for that open.

**Phone.** The whole row is one button, at least 44 px tall (`min-h-11`). It hides while focus is in the composer, and in half mode when the chat has a pin. An open with a composer focus request, such as a comment, shows no line. That focus would hide the line right after the reveal. View closes the Chat pane before it opens History, so Back leaves History in one press.

**Desktop.** After View, Back to Editor returns to the same heading chat, with focus in its composer.

**Accessibility.** The line is one sentence in one native button, outside the Virtuoso list. It takes one tab stop before the feed and announces nothing.

## Aggregation strategy

The line needs no grouping rule. It sums one Change window, from the Anchor at the reader's Last left to the head. The reader's absence is the unit.

The answer is net. The read compares this Section's print at the Anchor with its print at the head. Undo, quick reverts and back-and-forth edits cancel out. Many small edits by many people become one line. A bulk save, such as a restore, an import or a select-all paste, needs no special rule. A re-key that keeps the content reads as unchanged.

The design adds no session gap, settle time, fold or write-time group. It extends History's data, not its session grouping. The debounce already turns keystrokes into saves. All grouping happens at read time, so a later rule needs no migration.

## Trigger model

Nothing triggers at write time. The worker's print step writes Section prints on every save it stores, and nothing else.

The rule: the line counts net changes to this Section committed while the reader had no live session here. Changes that are wholly the reader's own never count.

The client sends one `history.section` read when a heading chat opens, if all of these hold:

- The reader is signed in, and their Last left is set.
- The reader has not opened View or "Show changes" for this toc-id in this document mount.
- On a phone, the open carries no composer focus request, such as a comment.

The server answers `changed`, `unchanged` or `unknown`:

1. Gate. Answer `unknown` with no query, unless the env value is on, the connection has a signed-in user, and a slot is free. The caps are one read in flight per connection and two per process.
2. Arrival. Read `arrivedAt` from the connection context. If it is missing, answer `unknown`.
3. Ends. Find the Anchor for the reader's Last left with the `history.list` rule. Read this toc-id's print and the form version from the Anchor row and the head row. A missing value, a form-version mismatch, or a head with no entry for the toc-id means `unknown`.
4. Re-key. The Anchor may have no entry for the toc-id. If another Anchor entry equals the head print and has no head entry, only the key moved: answer `unchanged`. Otherwise the Anchor print counts as empty.
5. Equal ends. Equal prints mean `unchanged`.
6. Scan. Read up to 200 rows after the Anchor, in version order. Per row, SQL returns only this toc-id's print, the form version and the attribution fields. Answer `changed`, with the newest counted commit time, when a counted step changed the Section. Otherwise answer `unchanged`.

What the scan counts:

- The printed rows split the scan into steps. A step changed the Section when its two printed rows hold different prints for it.
- A changed step counts when any of its rows is someone else's. It also counts when its version numbers skip, because only deletes leave gaps.
- The arrival bound: a row committed after `arrivedAt` plus `D` never counts, because the reader could watch that change live. `D` is about 100 s: the 60 s `maxDebounce`, the 10 s debounce and about 30 s of retries.
- If the scan stops at its cap before `arrivedAt` plus `D`, the read treats the change as someone else's and gives no time.
- A form-version change inside the scan means `unknown`.

Each version row already records its `trigger`, such as `websocket`, `api`, `mcp` or `revert`. It also records the user who started it in `triggeredBy`, and the signed-in editors in `contributors`.

A row is someone else's when one of these holds:

- It is an `api` or `mcp` row. That includes the reader's own Connected app, whose edit the reader did not watch.
- It is a `revert` or `revert-backup` row, and its `triggeredBy` is not the reader, or its `contributors` hold another id.
- It is any other row, and its `contributors` are empty or hold an id other than the reader's.

One exception covers the reader's last save before leaving. A row whose `contributors` hold the reader, committed within `D` after the reader's Last left, is the reader's own.

The `contributors` test stays because the window is not always away time. Last left moves only when a socket closes. So a member who edits all morning in a laptop tab, then opens the phone, still has yesterday's Last left. Without the test, the phone would report the member's own morning edits.

The client renders the line when the answer is `changed`, the answer arrived before the feed reveal, and the Channel guard passes (Architecture). Nothing sends push, email or an inbox row.

## Data model

**Prisma.** One nullable jsonb column on the version row: `Documents.sectionPrints`. It has no default, no index and no backfill. No read looks up a row by its prints, so it needs no index. A backfill would decode every stored snapshot, and the line can start without one. Like `contributors`, it describes its own row, and snapshots stay whole.

**Value.** The shape is `{ v: <form version>, s: { <toc-id>: <print> } }`. A Section print is SHA-256 over the Section's normal form, cut to 16 bytes and written in base64url.

**Normal form.** It lives in `canonicalSection`, so the Change digest shares it. After `canonicalizeBlock`, it sorts each marks array and merges adjacent text nodes with equal marks. It drops empty text nodes and treats `"content": []` as absent. Raw `fromYdoc` JSON keeps traces of edit history. So today a restore or a TOC move can change the form of a Section whose content did not change. On 415 local version pairs, the normal form agreed on every shared Section with the `nodeFromJSON` form.

**Form version.** `v` joins a manual integer with the sorted contents of `VOLATILE_BLOCK_ATTRS`. One comment beside `v` lists every input that decides a print. The read compares only rows with equal `v`.

**Entries.** The map holds one entry per flat Section whose heading has a usable toc-id. The key is the raw `toc-id` attribute. A usable toc-id has 1 to 36 characters of well-formed text and no control characters. That matches the length limit of a heading chat's id ([About toc-id](../../api/quickstart.md#about-toc-id)). These rules guarantee the value can never make the INSERT fail.

- The Preamble has no entry.
- An empty Section, with no heading text and no body, has no entry, so absent equals empty.
- A toc-id that appears twice in one snapshot has no entry.

**Null.** Null means unknown, never unchanged. A row is null when the print step throws or hits a cap, or when the row predates the deploy. A row is also null when another writer wrote it. Those writers are the queue-down fallback, the pre-restore backup, the schema-migration rebuild, REST create and Duplicate.

**Writer.** Only the worker save path writes the value, on the same INSERT as its row. Nothing updates it at runtime. A maintenance script that rewrites `Documents.data` sets the value to null in the same UPDATE.

**Retention.** The hourly reaper thins and purges the value with its row. Each row holds the full map, so the read can still compare any two surviving rows.

**Supabase.** No table, column, row, function, trigger, policy or grant changes.

## Architecture

**Worker, inside the save transaction.** After the merge and strip that [§Persistence](../../../apps/hocuspocus.server/CLAUDE.md#persistence) describes, a worker-only variant of the strip returns the decoded Y.Doc with the stripped bytes. The print step checks the byte cap on the merged bytes first. It builds ProseMirror JSON once and splits flat Sections with `segmentSections`. It applies the entry rules and hashes each normal form. It writes the value on the same INSERT. An error inside the print step writes null and never fails the save. After commit, the grid preview reuses the same JSON and drops its own decode.

**WebSocket process.** The occupancy extension adds `arrivedAt` to the context that its `connected` hook sets. One new read type, `history.section`, joins `history.list` and `history.watch` behind the same room checks and live seal. It does not use a new message family, because the relay refuses an unknown family. The input is the toc-id, bounded in length, and `since`. The reply echoes both, and carries the state and the newest change time. The handler decodes no snapshot, and it frees its in-flight slot in `finally`.

**Webapp chat.** The line keeps its state in its own hook, outside `ChatroomContext`, so message cards do not re-render. The pad reads the member's own Last left once per document mount with `getWorkspaceMemberLastLeft`. A viewed set of toc-ids sits beside it in the document-level store, because the docked chat unmounts during History. The set holds no times, so Last left stays the one clock. Neither reaches browser storage. The hook sends the read at chat open, in parallel with the feed load. It drops a reply for another toc-id.

**Channel guard.** The line renders only when the heading chat's channel belongs to the open document, or when no channel exists yet. If the chat store does not yet know which document the channel belongs to, the line hides.

**View.** The line's View passes the `since` its read used. `armCompareFromLastLeft` sets both the window and the Section slot. On desktop, View leaves a one-shot marker, and leaving History turns it into a composer focus request for that heading chat. On a phone, View closes the Chat pane, waits for its browser history entries to pop, then writes `#history`.

**Webapp History.** `pendingCompareSection` sits beside `pendingCompareSince` and survives `resetHistorySessionForMount` the same way. History builds both versions with `nodeFromJSON` from its decode cache. In each one it finds the heading with the toc-id and its flat range. A toc-id that appears twice in a version counts as not found, as in the print's entry rules. It runs the same `ChangeSet.create` with `buildDiffTokenEncoder` on the two ranges. It shifts the positions by the Section's start and paints only those decorations. When the Section diff is empty, History runs one more diff over the rest of the nested range. If the Anchor has no heading with the toc-id, History shows today's whole-document compare. The scroll uses `behavior: 'instant'`. History's failure arm ignores reply types that History did not send.

**Deploy order.** The migrate container adds the column first. The worker, the webapp and the WebSocket process then deploy in the workflow's existing order. A new webapp that meets an old server gets `history_failed` and shows nothing. Rollback is safe, because old code ignores the column.

**Boundaries.** Supabase, `rest-api` and Redis do not change. The only join across the two databases is Last left to an Anchor, which the `content_change` View and the Change digest already make.

## Settings model

One env value at the instance layer: `DOC_SECTION_CHANGE_LINE`, a boolean on the WebSocket process (`hocuspocus-server`), on by default (decision 7). It gates only the `history.section` read. When it is off, the read answers `unknown`, so no client gets Section change data. The WebSocket process logs the off state once at start. A change needs a container recreate, not a rebuild. The print step stays on, so turning the line back on works at once.

The original ask named admin, user and document layers. This design adds none of them:

- Admin: the env value already decides availability. A Redis admin key would reset on a Redis flush, with no log.
- User: the line is passive and personal. It alerts nobody, so a reader has nothing to silence.
- Document: the line describes each reader's own absence. An owner switch would hide it from every reader, while History still shows them the same facts.

Follow does not gate the line, because the line sends nothing. Follow still gates the `content_change` notification. Timings and caps, `D` included, stay code constants.

**Docs.** Add one row to [`apps/hocuspocus.server/ENV.md`](../../../apps/hocuspocus.server/ENV.md) and a CHANGELOG entry that names the Prisma migration. Each new rule goes to the file that owns its directory:

- [`apps/hocuspocus.server/CLAUDE.md`](../../../apps/hocuspocus.server/CLAUDE.md): the print step and its entry rules; a rewrite of `Documents.data` nulls the value; `history.section` never shows what `history.list` would hide from that connection.
- [`apps/webapp/CLAUDE.md` §Document Version History](../../../apps/webapp/CLAUDE.md#document-version-history): `history.section`, `pendingCompareSection` and History at a Section.
- [`apps/webapp/src/components/chatroom/CLAUDE.md`](../../../apps/webapp/src/components/chatroom/CLAUDE.md): the line's place, timing and phone rules.
- [`CONTEXT.md` §Document changes](../../../CONTEXT.md#document-changes): Section change line, History at a Section and Section print.

## Edge cases

| Case                                                                                                                                                                          | Behaviour                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A visitor, or a signed-in reader with no Last left                                                                                                                            | No read and no line. Visitors see no "Show changes". On a first visit, "Show changes" shows only today's "No earlier visit" toast.                                                                                                                                       |
| Only the reader changed the Section                                                                                                                                           | No line.                                                                                                                                                                                                                                                                 |
| The reader edits, then leaves while another person keeps typing                                                                                                               | The save that holds the reader's last edit commits within `D` after Last left, so it counts as the reader's own. Another person's edit inside that one save gives no line.                                                                                               |
| Two members co-edit one Section, more than `D` after the reader arrived                                                                                                       | No line, because those rows commit after `arrivedAt` plus `D`.                                                                                                                                                                                                           |
| A member sat in another Section during a visit                                                                                                                                | Changes committed more than `D` after the member arrived give no line. History and "Show changes" still show them.                                                                                                                                                       |
| A member kept the pad open in a hidden tab                                                                                                                                    | Chats opened in that tab show no line for changes committed more than `D` after it connected. Last left stays at the last instant the tab counted as reading, so a later visit can show the line.                                                                        |
| A reconnect, a deploy or a second tab during a visit                                                                                                                          | `arrivedAt` moves to the new connection, so an earlier change from that visit can give a line.                                                                                                                                                                           |
| The reader's own Connected app changed the Section                                                                                                                            | The line shows. History shows the "Connected app" badge.                                                                                                                                                                                                                 |
| A signed-out person edited                                                                                                                                                    | Empty `contributors` count as someone else, so the line shows.                                                                                                                                                                                                           |
| A restore                                                                                                                                                                     | A restore by someone else shows the line, and History shows the "Restored" badge. A restore by the reader is the reader's own.                                                                                                                                           |
| A copy made by Duplicate                                                                                                                                                      | The read uses the copy's own History, under the same rules as any other document.                                                                                                                                                                                        |
| A rename, or a level change at the caret                                                                                                                                      | The toc-id stays and the print changes, so the line shows.                                                                                                                                                                                                               |
| A move by TOC drag                                                                                                                                                            | No line while the level stays. A drag that sets a new level changes the print, so the line shows.                                                                                                                                                                        |
| A merge by Backspace, TOC Delete section, or an emptied heading                                                                                                               | A merged or deleted heading's chat shows no line. An emptied heading with no body has no print entry, so its chat shows no line. An emptied heading that keeps its body keeps its entry, so its chat can show the line. After a merge, the Section above shows the line. |
| A split by Enter inside a heading                                                                                                                                             | The first half keeps its toc-id and shows the line. The new heading's chat shows the line when someone opens it.                                                                                                                                                         |
| A re-key: select-all paste, a file import in the editor, a Markdown replace through REST, heading to paragraph and back, a level change over several blocks, or cut and paste | Each old chat shows no line. A new toc-id whose content equals a Section at the Anchor reads as unchanged. A new Section with no match at the Anchor shows the line.                                                                                                     |
| An undo of a heading delete inside the window                                                                                                                                 | The same toc-id returns, and equal content at both ends gives no line.                                                                                                                                                                                                   |
| A bulk save, an import or a restore of many Sections                                                                                                                          | One window covers it. Each opened chat shows at most one line.                                                                                                                                                                                                           |
| A reader's first signed-in open of a heading chat                                                                                                                             | That open creates the channel row. Until the chat store knows which document that channel belongs to, the Channel guard hides the line.                                                                                                                                  |
| The trailing empty heading                                                                                                                                                    | No line while it stays empty. A REST or MCP append after it joins its Section, which has no TOC row. Its chat still opens from the editor's heading button, where the line can show.                                                                                     |
| Title                                                                                                                                                                         | The Title's heading chat gets the line for the Title's own flat Section.                                                                                                                                                                                                 |
| The workspace chat and the Preamble                                                                                                                                           | No line. The `content_change` View covers the whole document, and the Preamble has no heading chat.                                                                                                                                                                      |
| A parent heading chat when only a sub-heading changed                                                                                                                         | No line, because the line follows the flat Section. "Show changes" on the parent says "Only its sub-headings changed since you left."                                                                                                                                    |
| An empty heading chat                                                                                                                                                         | The line shows under the same rules, above the empty state.                                                                                                                                                                                                              |
| Rows from before the deploy, a null end row, or a form-version change in the window                                                                                           | The answer is `unknown`, so no line shows.                                                                                                                                                                                                                               |
| A window longer than the scan cap                                                                                                                                             | The net answer stays exact. If the scan stops before `arrivedAt` plus `D`, the line shows with no time.                                                                                                                                                                  |
| A Last left older than the oldest surviving row                                                                                                                               | The Anchor is the oldest surviving row, as in History compare. Version gaps from thinning count as someone else. History names the start date.                                                                                                                           |
| A late, refused or failed reply, an old server, a full cap, or the env value off                                                                                              | No line for this open, with no toast and no retry.                                                                                                                                                                                                                       |
| Last left moves during the visit, for example when another tab closes                                                                                                         | The line and its View keep the mount value. "Show changes" and the `content_change` View read Last left at click time.                                                                                                                                                   |
| Private turned on during a visit                                                                                                                                              | Non-owner connections close, so the read fails and no line shows.                                                                                                                                                                                                        |
| A REST append repeats a toc-id that the document already holds ([About toc-id](../../api/quickstart.md#about-toc-id))                                                         | Neither heading gets a print entry, so no line shows. History cannot find that Section and says so.                                                                                                                                                                      |
| Phone keyboard up, focus in the composer, or half mode in a chat with a pin                                                                                                   | The line hides.                                                                                                                                                                                                                                                          |

## Scalability

**Producer.** The print step runs once per stored save. The debounce bounds live saves to one per room and replica, after 10 s idle, or about 60 to 70 s into continuous typing. A Connected app is bounded by 60 calls a minute. More editors therefore do not mean more saves.

**Write cost.** The print step runs `fromYdoc`, segmentation, the normal form and SHA-256 inside the lock. It adds about 5 to 9% of save CPU up to 74 KB, and 15 to 19% at 5.4 MB. The lock hold grows by about 0.2 ms at 74 KB and 8 to 10 ms at 5.4 MB, for one job alone. Production runs up to 10 jobs per worker replica on one JavaScript thread, so the print step also delays other open transactions there. A version collision runs the print step again after at least 2 s. Reusing the JSON for the grid preview lowers CPU, not the lock hold.

**Caps.** The Section cap starts at 1,000. The local maximum is 268 headings. The byte cap comes from the amd64 measurement.

**Storage.** One entry is about 44 B. Production held 2,163 version rows on 2026-09-05, so the column should add a few MB at most. Retention bounds the total while thinnable rows arrive slower than the reaper deletes them. It deletes at most 10 batches of 1,000 rows per hourly pass, about 240,000 rows a day.

**Read cost.** Most reads end after the two end rows, because the prints are equal. The read runs the scan only for a changed Section. Postgres still loads each scanned row's whole value: about 12 KB at 268 Sections, and about 44 KB at the cap. The read decodes no snapshot. Each WebSocket replica has one small database pool, shared with other work. The in-flight caps keep at most two of its connections on `history.section` reads.

**Realtime and Supabase.** No realtime message and no Supabase row. One indexed select per signed-in document mount reads Last left.

**Stress cases.**

- Seven people on one Section for ten minutes cost 9 to 20 print steps. A member who was away sees one line. The seven see a line only for edits that committed within `D` of their own arrival.
- A restore of 92 Sections costs one save and at most one line per opened chat.
- A Connected app at its full call budget costs one print step per call, and still one line.

**Anchor query.** No `(documentId, createdAt)` index exists. A custom plan walks `Documents_createdAt_idx` back from `since`. It passes every row that other documents saved between this document's last earlier save and `since`. A generic plan reads all of this document's rows. An index would also serve History compare and the Change digest, but it adds a write inside the save lock. So it ships only after a failed measurement, alone, with `CREATE INDEX CONCURRENTLY`.

## Trade-offs

| Decision                         | Chosen                                                                           | Rejected                                                | Why                                                                                                                                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where the change fact lives      | Derived on read from History version rows                                        | Stored notice rows in heading chats                     | A chat author must be a person who acted. A fan-out must never create the lazy channel row. Four unread paths count notice rows. Each insert also writes the `channels` row and sends a realtime update. Stored rows outlive the version rows they describe. |
| Placement                        | One row above the message list                                                   | A system message, or rows inside the feed               | A new feed row kind must join six feed paths, and a past grouping projection broke under merges. A row outside the list changes no feed path.                                                                                                                |
| Audience and clock               | Personal, from the reader's own Last left                                        | A shared line bounded by the newest human message       | Last left is the one clock, and the `content_change` View already uses it. Visitors have no Last left, so a shared line needs a second clock.                                                                                                                |
| Changes made during a visit      | Rows after `arrivedAt` plus `D` never count                                      | Ending the Change window at arrival                     | The line and View keep one window, so a revert inside the visit cannot make View contradict the line.                                                                                                                                                        |
| Who counts as someone else       | `contributors` plus the row's operation                                          | The creator walk at launch                              | The walk adds worker cost before production shows a need. The cheaper test can err both ways, and History stays complete either way.                                                                                                                         |
| The reader's last save           | The reader's own when it holds the reader and commits within `D` after Last left | The reader's own whenever it holds the reader           | The rejected rule hides another person's change whenever it shares a save with any edit by the reader, including the toc-id stamps a pad open writes.                                                                                                        |
| Wording at launch                | One fixed sentence                                                               | Operation names and editor names                        | Editor names need the creator walk. Operation names need a profile read on the WebSocket process, for a share of lines that nobody has measured. View opens History, which shows the operation badge.                                                        |
| Where the worker writes prints   | On the version row INSERT                                                        | A post-commit UPDATE                                    | [`apps/hocuspocus.server/CLAUDE.md`](../../../apps/hocuspocus.server/CLAUDE.md) settles one append-only `Documents` table, and no runtime path updates a version row.                                                                                        |
| Stored shape                     | A map from toc-id to print, with a form version                                  | An ordered list, or a per-save list of changed Sections | SQL can read one Section per row from a map. A full map per row survives thinning; a change list does not.                                                                                                                                                   |
| Read host                        | A new `history.section` type with its own caps                                   | A filter on `history.list`, or a REST route             | Sharing `history.list` puts chat under its 250 ms cooldown, and a refused first page blanks the History sidebar.                                                                                                                                             |
| What History at a Section paints | A diff of this Section only                                                      | The whole-document compare with a scroll                | Past 5000 tokens of edit distance, a whole-document diff becomes one change, so a long absence could never show the Section.                                                                                                                                 |
| Reading Last left                | Once per document mount for the line                                             | A read per chat open, or a server read                  | A mount read leaves one round trip at chat open. A server read adds a Supabase call to every chat open on the WebSocket process.                                                                                                                             |
| Settings                         | One env value that gates the read                                                | No setting, or gates on the worker too                  | Operators can stop a new event-loop read without a release. A worker gate would act per document, after its next save.                                                                                                                                       |
| Phone History path               | Keep today's close of the heading chat                                           | Keep the heading chat through History                   | Keeping it also changes today's `content_change` View and needs device checks of three Back paths, so it is its own change.                                                                                                                                  |
| First part                       | History at a Section, from the webapp alone                                      | The print and the line first                            | It ships value alone with no server work. It still needs approval of its design-system catalog edits (decision 3).                                                                                                                                           |

## Alternatives

- **Stored notice rows with Slack canvas rules.** After five quiet minutes, the worker posts one shared notice row per changed Section into existing heading chats. Later edits join that row until someone posts. Why not: it still needs the derived read, so it costs more. It touches all six deploy surfaces, including the largest hand-applied SQL. Its additive rule posts nothing for removals and rewrites.
- **Derived rows per History session in the feed.** On chat open, the client places one row among the messages for each session that changed the Section. Why not: nothing bounds the rows by the conversation, so in sparse chats they outnumber messages. It shows each session, not the net outcome. It adds a feed row kind to every merge path.
- **Change markers bounded by the conversation.** At most one derived marker sits in each gap between two human messages. Why not: every reader sees every marker, editors and visitors included. The debounce can place a change on the wrong side of a message. It adds a feed row kind.
- **A shared summary line.** One shared line shows while nobody has posted since the Section's latest change. Why not: commit times lag keystrokes, so an editor's last save often lands after their own "done" message. Its fallback boundary, `channels.last_activity_at`, also moves on a pin, a soft delete and notice rows.
- **History at a Section only.** Nothing enters chat. Why not as the whole answer: it gives no passive signal, and a phone cannot open it, so the original ask for chat stays unmet. This RFC builds it first and keeps it as the fallback.
- **Nothing.** Why not: no in-app surface names a changed Section, and History cannot open at one.

## Recommended solution

Build two parts, in this order:

1. History at a Section, from the webapp alone.
2. The Section change line, with its Section print and its `history.section` read.

Editor names, the third part, wait for decision 6.

## Implementation parts

### 1. History at a Section

A visual preview of the status line and the "Show changes" row comes first, for approval under the design-system lock. Then:

- History gains `pendingCompareSection`, the Section diff, the sub-heading check, the status line, the failure toast and one instant scroll.
- `armCompareFromLastLeft` takes an optional toc-id and sets both slots.
- Every diff run gains its hidden labels, and `compareDecorations.test.ts` changes in the same edit.
- The desktop TOC row menu gains "Show changes" for signed-in members.

This part ships value alone: a member sees one Section's changes since Last left in two clicks.

- **Deploy surfaces:** webapp only.
- **Exit criteria:** a desktop browser check in the light, dark and high-contrast themes, with signed-in accounts A and B on one public document:
  1. B leaves. A edits Section X. B returns and chooses "Show changes" on X.
  2. History paints only X from B's Last left. The status line names X and the window, and it holds focus.
  3. For an unchanged Section, the status line says it did not change, also after A adds 1,000 words elsewhere.
  4. For a parent whose sub-heading changed, the status line says "Only its sub-headings changed since you left."
  5. A first visit shows only the "No earlier visit" toast.
  6. The scroll has no animation, and Back to Editor returns to the pad.
  7. VoiceOver and NVDA read the added and removed labels.

### 2. The Section change line

Start only when the heading-chat reach gate in decision 5 passes (Measurements before build). A visual preview comes first. It shows the line above the new-messages banner, on desktop and in half mode on a 390x844 phone. It shows both action labels, "View changes" and "Show changes", so the maintainer can pick one. Then:

- The normal form in `canonicalSection`, with one unit case per edit-history trace in the existing `diffSections` tests. It also removes false "modified" Sections from the Change digest, so it may ship earlier. It must land before the first print.
- The Prisma column, the print step, and one skip counter by reason, seeded at 0 in `seedWorkerAlertSeries`.
- `arrivedAt`, and the `history.section` read with its caps and the env value.
- The line: the per-mount Last left and viewed set, the Channel guard and the phone rules.
- View: the passed `since`, the desktop focus return and the phone close-then-open order.
- The History failure-arm guard, and `formatRelativeTime` in `@utils/formatTime`.
- Two client events through `trackEvent`: one per read with its outcome, and one per View.
- The docs listed in Settings model.

- **Deploy surfaces:** Prisma migration (migrate container), worker, WebSocket process and webapp, plus docs. Supabase SQL and `rest-api` do not change.
- **Exit criteria:** a two-browser check with accounts A and B on one public document, after one save past the deploy. Run it in light and dark on desktop, and on iOS Safari and Android Chrome with a mobile user agent:
  1. B is away while A edits Section X. B returns and opens X's chat: the line shows.
  2. B returns, edits X alone, then opens X's chat in the same visit: no line.
  3. B stays longer than `D`, then A and B co-edit X. B opens X's chat: no line.
  4. A visitor opens X's chat: no line, and the client sends no read.
  5. View opens History at X from B's Last left. On desktop, Back to Editor returns to X's chat with focus in its composer, and the line stays hidden.
  6. On a phone, the line is one touch target. It hides with composer focus, and in half mode in a chat with a pin. Back to Editor, Android Back and iOS swipe-back each leave History in one press.
  7. The line shows only when the Channel guard passes.
  8. At 320 CSS px, the whole sentence shows.
  9. With the env value off, no line shows.

  The skip counter shows zero errors over a long test run, and the amd64 lock hold stays within the budget set before build. Six weeks after release, check the client events. Remove the line if it shows on more than half of reads. Also remove it if readers press View on fewer than one in ten shown lines. A high show rate means the line is not rare. A low View rate means it is noise. Removal touches only the read and the webapp.

### 3. Editor names (only if the maintainer chooses them)

The worker adds a creator walk for changed Sections only, against the locked head's state vector. It stores bound client ids in the same value, so no migration is needed. The read names a person only when the walk and `contributors` agree. The line shows at most two names, then "and others". It never shows a number, the reader's own name or a person who removed text. Names resolve at read time.

- **Deploy surfaces:** worker, WebSocket process and webapp. No migration and no Supabase SQL.
- **Exit criteria:** start only when four things hold. In production, at least one in four changed Sections can be named honestly. The walk's amd64 cost stays within the lock-hold budget set before build. Deleting a user removes that user's `DocumentClientAuthor` rows. The maintainer approves the wording. Then a two-browser check shows "Edward edited this section" for a bound edit. It shows "This section changed" when an unbound editor also changed the Section.

## Decisions for the maintainer

1. **Accept a scoped overturn of the earlier ruling "Do not build a new 'since you left' panel"?** Options: (a) accept, and build both parts; (b) keep the ruling, and build History at a Section only. Recommendation: (a). The line is one sentence and one button that paints no change. It uses Last left, the one clock, and opens History compare. Two facts are new since the ruling. The first is the maintainer's 2026-10-01 ask. The second is the 2026-09-22 decision to place heading chats under changed Sections in the Change digest.
2. **Does the arrival bound create a second clock, against the one-clock ruling (Rulings)?** Options: (a) no, because it only decides which rows count, and it moves neither end of the Change window; (b) yes, so drop it. Recommendation: (a). Without it, each of the original ask's seven co-editors sees a line for changes they watched.
3. **Approve three catalog edits under the design-system lock, after a visual preview?** The edits are the line, "Show changes" with `Icons.history`, and the History status line. The line's preview also offers "Show changes", so the line and the TOC row menu can share one label. Options: (a) all three; (b) only the two History edits; (c) none. Recommendation: (a). No edit adds a token, species, size, radius, shadow or ink step.
4. **Give added text in compare a visible cue that does not rely on colour?** Options: (a) yes, by a ruling under the design-system lock; (b) no, keep the hidden labels only. Recommendation: (b) for this RFC. A visible cue serves today's View too, so it belongs in its own change. Until that change ships, compare makes no WCAG 1.4.1 claim, because a tint alone marks added text.
5. **Use a gate for building the line?** Options: (a) use "at least 1 in 10 recently edited documents has a signed-in heading-chat join"; (b) set another threshold; (c) no gate. Recommendation: (a). Below it, too few members open heading chats to see the line.
6. **Show editor names on the line?** Options: (a) never; (b) after measurement, as the third part; (c) at launch, with the walk in the second part. Recommendation: (b). Names wait for the line's six-week check, so the walk is not built for a line that may be removed. This departs from the original ask's example "Edward and Harvey updated this section".
7. **Default for self-hosted installs?** Options: (a) on, with the env value as the off switch; (b) off until an operator turns it on. Recommendation: (a). The line writes nothing to Supabase and sends nothing.

## What we will not build

- A new `message_type`, `notification_category`, chip arm or feed row kind. The line sits outside the feed.
- A diff, snippet, Magnitude, face or count in chat. History compare is the only paint.
- Push, email, inbox rows, unread counts, badges, sounds or live announcements. The Change digest already covers email, and one change must not reach one reader twice.
- Live refresh on `document:saved`, or a settle time. Readers in the pad already see the text.
- A dismiss control, a stored seen state, or a second clock. Last left is the one clock.
- A notice in a chat whose heading is gone, or a link to the heading that replaced it. Such chats exist today, so a fix for them ships as its own change.
- A roll-up of sub-heading changes into a parent chat. The flat Section matches the change engine and body-comment routing.
- A TOC change mark. TOC visuals are locked, so it stays out of scope until the maintainer asks for it.
- A change stepper, `<ins>`, or range-label and tooltip fixes in compare. They serve today's View too, so they ship as their own change. The hidden labels still ship here, because a screen-reader user could not otherwise find the change that History at a Section reports.
- Live per-Section capture on the WebSocket process, an editor plugin or per-heading editor state. Capture can name the wrong person after a resync, and per-heading state costs a rebuild on every remote transaction.
- A `moved` state, or an ordered list of Sections with their levels. A move is not a content change, and SQL reads one Section per row from a map.
- Owner, personal, channel or admin Redis settings, or timings as settings.
- Generated summaries, editor-written reasons, or replies and links to the line. A fixed sentence is enough, and an ordinary message answers a change.

## Rulings

Each row is an earlier maintainer ruling that this design must respect. Where one exists, a link points to the public file with the related rule. A row with no link records a ruling that no public file holds.

| Ruling                                                                                                                                                                           | Status             | Note                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| One clock: Last left ([`CONTEXT.md` §Document changes](../../../CONTEXT.md#document-changes))                                                                                    | Kept               | The line and its View use Last left. The arrival bound only decides which rows count (decision 2).                            |
| History compare is the in-app paint ([`apps/webapp/CLAUDE.md`](../../../apps/webapp/CLAUDE.md#bookmark-and-notification-panels))                                                 | Kept               | Chat shows no diff. History at a Section uses the same compare, limited to one Section.                                       |
| Do not build a new "since you left" panel                                                                                                                                        | Overturn requested | Decision 1.                                                                                                                   |
| Do not jump to a heading on the live pad as the View action                                                                                                                      | Kept               | The scroll happens in History's read-only editor.                                                                             |
| A person sitting in the pad gets no `content_change` notification ([`apps/hocuspocus.server/CLAUDE.md`](../../../apps/hocuspocus.server/CLAUDE.md#hocuspocus-server))            | Kept               | The fan-out does not change, and the arrival bound applies the same reason to the line.                                       |
| One full snapshot per version, one append-only `Documents` table ([`apps/hocuspocus.server/CLAUDE.md`](../../../apps/hocuspocus.server/CLAUDE.md))                               | Kept               | The worker writes the print on the version row INSERT. A maintenance rewrite of `Documents.data` nulls it in the same UPDATE. |
| A service-role write names nobody, and no bot user is minted ([`apps/hocuspocus.server/CLAUDE.md`](../../../apps/hocuspocus.server/CLAUDE.md#hocuspocus-server))                 | Kept               | No chat row, so no author column.                                                                                             |
| A contributor count is a floor, and nobody is named as a deleter ([`apps/hocuspocus.server/CLAUDE.md`](../../../apps/hocuspocus.server/CLAUDE.md#digest-email-links-and-counts)) | Kept               | No count ships, and removals name nobody.                                                                                     |
| `store()` never decodes or throws ([`apps/hocuspocus.server/CLAUDE.md`](../../../apps/hocuspocus.server/CLAUDE.md#hocuspocus-server))                                            | Kept               | `store()` does not change. The print step runs in the worker, and its entry rules keep the INSERT valid.                      |
| No new notification category without both SQL gates; a read path creates no channel ([`packages/supabase/CLAUDE.md`](../../../packages/supabase/CLAUDE.md))                      | Kept               | None added.                                                                                                                   |
| A server-minted version row needs a machine trigger ([`apps/hocuspocus.server/CLAUDE.md`](../../../apps/hocuspocus.server/CLAUDE.md#retention-and-schema))                       | Kept               | No new version rows.                                                                                                          |
| The design system is locked ([`design-system.md`](../../../.cursor/docs/design-system.md))                                                                                       | Kept               | Three catalog edits need approval (decision 3).                                                                               |
| Signed-in-only actions are hidden from visitors                                                                                                                                  | Kept               | Visitors see no line and no "Show changes".                                                                                   |
| Settled TOC decisions ([`apps/webapp/CLAUDE.md`](../../../apps/webapp/CLAUDE.md#toc-and-heading-actions))                                                                        | Kept               | No TOC visual changes. One row joins the desktop TOC row menu.                                                                |
| An earlier maintainer ruling excludes a new chip species, card or word-diff in chat                                                                                              | Kept               | The line reuses the pinned bar row, sits outside the feed and holds no diff.                                                  |
| History restore is for signed-in writers only ([`apps/webapp/CLAUDE.md`](../../../apps/webapp/CLAUDE.md#document-version-history))                                               | Kept               | Restore does not change.                                                                                                      |

## Risks

- Relayed edits, signed-out co-editors, job-id dedupe and two replicas can mix the reader's edits with another person's. The line can then miss a change, or report the reader's own edit as someone else's. Mitigation: the sentence names nobody, and History stays complete. The creator walk in the third part makes bound edits exact.
- Rows that the reader co-edited with others, and watched live on another device, can still produce a line on this device. Mitigation: accept it. The sentence stays true, and View shows the change.
- The print step lengthens the save lock on the largest heads and delays other jobs on that worker thread. Mitigation: measure on amd64 at concurrency 10, set the caps, and check the byte cap before `fromYdoc`.
- The Anchor query's cost can grow with writes across all documents. Mitigation: measure first, and add the index only after a failed measurement.
- Desktop TOC clicks send bursts of reads into a small shared pool. Mitigation: the in-flight caps answer `unknown` when full. The read-cost measurement records document-load time during a burst. The env value can turn reads off.
- Replies often arrive after the feed reveal, so the line rarely shows. Mitigation: the read event counts late replies. Add a per-mount cache only if they are common.
- A print input can change without a change to `v`. Mitigation: `v` includes `VOLATILE_BLOCK_ATTRS`, one comment lists every input, and a `v` change inside the window reads as `unknown`.
- The normal form does not fill schema defaults, but History's diff does. An attribute stored with its default on one side only would make the line and History disagree. Mitigation: if production shows such a case, switch the print to the `nodeFromJSON` form and change `v`.
- Lines start gradually, because old rows carry no prints. Mitigation: accept it. History stays complete.
- A member who opens no heading chat during a visit loses the line when Last left moves. Mitigation: accept it. History browsing still shows the change.
- On a phone, View closes the Chat pane, so a reader who came from a mention loses that message's place. Mitigation: accept it here. Keeping the chat through History is its own change.
- A REST append can store a toc-id that the document already holds ([About toc-id](../../api/quickstart.md#about-toc-id)). Then that Section gets no line, and History cannot find it (Edge cases). Mitigation: fix the repeat at its source as a separate change.
- Editor names can read as blame. Mitigation: each line is personal, the verb is "edited", and the line never names people who removed text.

## Measurements before build

Production reads are read-only. Snapshots decode locally, never inside a production container.

- **Heading-chat reach (the gate in decision 5).** The share of documents edited in the last 30 days where a signed-in member joined a heading chat in those 30 days. A first signed-in open writes the `channel_members` row, so the share is a lower bound. Below 1 in 10, build History at a Section only.
- **Worker cost on amd64.** CPU, peak memory and the `FOR UPDATE` hold at the p50, p90 and largest heads, at concurrency 10 with two large documents in flight. Add production Sections per head at p99 and at the maximum. These set the byte cap, the Section cap and the lock-hold budget. If the hold stays too long under the caps, the write placement returns to the maintainer for a decision.
- **Read cost.** Build a synthetic table of at least 100,000 rows, with one document whose rows sit in one burst. Test a `since` deep in its quiet period, and a `since` before its first row. Run each case under forced custom and generic plans, and record rows removed by filter, buffers and time. Then send 100 reads in one second, and record event-loop time, document-load time and the `onAuthenticate` lookup time. These size the caps and decide the index.

## Design constraints

Each constraint below binds the build and any later change.

- The line is never built from stored chat rows.
- Chat rows, previews and counters carry no document text, Section name, editor name or diff for this feature.
- Section change facts load through the document's own access check each time they are shown.
- The feature never shows a reader more about a Section's change, author or time than History shows that reader at that moment.
- The design reads only the viewer's own Last left.
- Section prints never leave the server. A reader receives only the computed answer.
- A Section print resists a crafted collision, so an edit cannot hide a Section change on a public document.
- No document content can stop a version row from saving through the print value, and the value has a bounded size.
- A toc-id from document content is untrusted wherever it becomes a stored key, a query, a selector or a URL.
- The read refuses a connection with no signed-in user before any query. It has a cost bound per connection and per process, for any `since` value.
- A client-sent bound can only narrow what the server allows for that connection, never widen it.
- Names rest only on server-verified identity, and a best-effort client binding never reads as proof of authorship. Stored ids that may name an editor stay reachable by the user-erasure path.
- With the env value off, the server sends no Section change data.
- The client events carry no document id, toc-id or document text.

## Questions from the original ask, answered

| Question                                                                                       | Answer                                                                                                                   | Detail               |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| 1. What triggers an entry?                                                                     | A heading chat open triggers one read. Saves only write prints.                                                          | Trigger model        |
| 2. How to group: time, session, author, semantic change, inactivity, revision, or another way? | Another way. The unit is the reader's absence: one net Change window.                                                    | Aggregation strategy |
| 3. How are many authors shown?                                                                 | At launch, the line names nobody. If the maintainer chooses names (decision 6), it shows at most two, then "and others". | Implementation parts |
| 4. How do many small edits become one entry?                                                   | The debounce makes saves, and the net compare makes one answer.                                                          | Aggregation strategy |
| 5. Reuse or extend the History grouping?                                                       | Extend History's data, not its session grouping.                                                                         | Aggregation strategy |
| 6. Stored messages, virtual rows, or derived?                                                  | Derived on read. Chat stores nothing.                                                                                    | Trade-offs           |
| 7. Permanent or temporary?                                                                     | Neither. It is computed per open, and it goes away once Last left passes the change.                                     | Trigger model        |
| 8. Shared or personal?                                                                         | Personal, from the reader's own Last left.                                                                               | Trade-offs           |
| 9. How is last-seen state known?                                                               | Last left, read once per document mount.                                                                                 | Architecture         |
| 10. People who watch live?                                                                     | A change committed more than `D` after they arrived never gives them a line.                                             | Trigger model        |
| 11. Many fast editors?                                                                         | One print step per save, and one bounded read per chat open.                                                             | Scalability          |
| 12. Diff without flooding the chat?                                                            | Chat shows no diff. View opens History at a Section.                                                                     | Proposed UX          |
| 13. Expand into a richer diff?                                                                 | Yes, in History at a Section, never in place.                                                                            | Proposed UX          |
| 14. No duplicated History data?                                                                | The print describes its own version row, and chat stores nothing.                                                        | Data model           |
| 15. No noisy database growth?                                                                  | No Supabase rows. One capped value per version row, thinned by retention.                                                | Scalability          |
| 16. Rename, move, merge, delete?                                                               | A rename shows the line, a level-keeping move shows nothing, and a lost heading's chat shows no line.                    | Edge cases           |
| 17. Mobile?                                                                                    | One touch target with phone hide rules. Phones can open History at a Section only through the line.                      | Proposed UX          |
| 18. Yjs, Tiptap and live collaboration?                                                        | No editor plugin and no work on the edit path. The worker prints stored snapshots.                                       | Architecture         |
| 19. Settings layers?                                                                           | One instance env value, with a reason for each layer it does not add.                                                    | Settings model       |
| 20. Is chat the wrong place? Is there a better design?                                         | Partly. Chat is right for one personal pointer, and wrong for a log or a diff. History at a Section holds the detail.    | Alternatives         |
