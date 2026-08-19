# docs.plus against the Tiptap Cloud document server

**Verdict.** At the API level, most of what looks missing is already a recorded decision. At the product level, three whole Tiptap products have no docs.plus equivalent: AI, tracked changes, and page layout. None of the three is a defect, because docs.plus sells a different thing — a per-heading chat that Tiptap has no answer to at all.

**Date.** 2026-08-19

Read the product table first for the wide view. The per-endpoint tables below it answer parity on the document server alone.

## Scope and why the comparison is only half fair

docs.plus does not run Tiptap Cloud. It self-hosts `@hocuspocus/server` v3 and owns its own REST surface at `apps/hocuspocus.server`. Tiptap Cloud is a paid product on a private npm registry, so its API is a benchmark, not a contract docs.plus owes anyone.

The comparison is useful in one direction and misleading in the other. It is useful for finding a capability nobody here has considered. It is misleading as a scorecard, because docs.plus carries whole surfaces Tiptap Cloud does not: soft delete with a trash and a purge, document conversion to and from DOCX, Markdown and ODT, media upload and serving, link unfurling, transactional email, web push, and per-heading chat.

Six Tiptap pages were read in full. Sources are listed at the end.

## How to read the tables

| Verdict              | Meaning                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Have**             | docs.plus does this, in a recognisably similar way.                                           |
| **Have differently** | docs.plus solves the same need with a different shape. Not a gap.                             |
| **Cut**              | Considered and deliberately not built. `PROMPT-inject-content-rest-api.md` §11 owns the list. |
| **Ruled**            | Decided against on principle. Reopening needs new evidence, not a new design.                 |
| **Gap**              | Genuinely absent, and nobody has decided against it.                                          |
| **Not a goal**       | Absent because a docs.plus design choice removes the need.                                    |

A **Cut** is not a finding. Naming one as new work is a rule violation here. Every cut below carries the row that would reopen it, from `BACKLOG-hocuspocus-backend.md`.

## Product surfaces

The six pages read for this study describe one Tiptap product: the document server. The platform sells more than that, and the pricing page enumerates the rest. This is the wide view.

| Tiptap product                                                                        | docs.plus                                                                                                      | Verdict                                   |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Editor, open source under MIT                                                         | Uses it, and publishes five extensions of its own                                                              | Have, plus extras Tiptap has no equal for |
| Real-time collaboration                                                               | Self-hosted `@hocuspocus/server` v3, two replicas, shared Redis                                                | Have                                      |
| Document history                                                                      | Automatic versions, named checkpoints, restore, pre-revert backup                                              | Have                                      |
| Compare versions                                                                      | Server diff at `GET .../versions/:version/diff`, plus editor decorations                                       | Have                                      |
| Comments                                                                              | A comment is a chat message anchored to a text run or a media node                                             | Have, and shaped differently              |
| In-line AI extension                                                                  | Nothing                                                                                                        | **Gap**                                   |
| AI Toolkit, and Server AI Toolkit for backend agents                                  | Nothing                                                                                                        | **Gap**                                   |
| Tracked changes and redlining, sold separately, in alpha                              | Nothing. Version history is a different thing                                                                  | **Gap**                                   |
| Convert Service: import DOCX and Markdown; export DOCX, PDF, DOC, ODT, EPUB, Markdown | Self-hosted. Imports DOCX and Markdown. Exports DOCX, Markdown, ODT. PDF comes from print styles, not a server | Have, narrower                            |
| Pages: paginated layout, page breaks, margins, headers, footers                       | Print styles for PDF only                                                                                      | **Gap**                                   |
| UI Components                                                                         | Own design system, with tokens and themes                                                                      | Not a goal                                |
| Webhook APIs                                                                          | Nothing leaves the system                                                                                      | **Gap**, tracked as T2                    |
| Backend document manipulation                                                         | `PATCH .../content`, in two modes                                                                              | Have, narrower                            |
| Hosting region choice, log retention tiers, SOC 2, an uptime guarantee                | Self-hosted, with Prometheus, Grafana and Loki                                                                 | Not applicable                            |

### The three product gaps, and whether they matter

**AI is the largest absence, and it is a strategy question, not a backlog row.** Tiptap now sells AI on both sides: an in-editor extension, and a Server AI Toolkit that edits a document with no browser open. docs.plus has no AI anywhere. Note what the server-side half needs, because docs.plus already built it for another reason: a way to read a document, patch part of it, and show the result for review. That is the content API, node targeting, and version compare. So H1 and H2 are the groundwork whether or not AI is ever the goal.

**Tracked changes is the gap a document product feels next.** Version history answers "what did this document look like before". Redlining answers "may I propose this edit". Those are different features, and docs.plus has only the first. Tiptap's is in alpha and sold separately, which says it is hard. It also pairs with comments, and docs.plus comments are already anchored to a text run, so the anchor work is partly done.

**Page layout is a real gap with a narrow audience.** Tiptap Pages gives page breaks, margins, headers and footers in the editor. docs.plus renders PDF through print styles, so a writer never sees page boundaries while editing. This matters for anyone producing a printed document and for nobody else. docs.plus is a collaborative web document with a chat in it, so I would leave this alone.

### What docs.plus has that Tiptap Cloud does not

A gap list read alone would suggest docs.plus is behind. On the product axis that is false, because the central docs.plus feature has no Tiptap counterpart at all.

- **A chat room per heading.** The table of contents carries presence, unread counts and filters, and every heading opens its own conversation. Comments are unified into that same message model rather than bolted beside it.
- **Media as a first-class citizen.** Upload, serving, an album layout in the feed, and a gallery with zoom and pan.
- **Link unfurling** through its own metadata pipeline, with request-forgery guards.
- **Notifications people actually receive:** transactional email, digests compiled on a schedule, and web push.
- **A document access model:** public, private and read-only, with private meaning owner-only and failing closed.
- **A document lifecycle:** soft delete, a trash list, restore, permanent delete, and a purge after retention.
- **Bookmarks, a notification panel, and an admin dashboard.**

Tiptap sells a document editing platform to developers. docs.plus is a product for readers and writers who argue about a document section by section. The overlap is the editor and the collaboration layer, and that is where the parity tables below apply.

## Document management API

| Tiptap capability                                                  | docs.plus                     | Where                                                                                   |
| ------------------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------- |
| Create a document from a Yjs or JSON body, addressed by identifier | Have differently              | `POST /api/documents` creates by slug. Content arrives through `PATCH .../content`.     |
| List documents, with `take` and `skip`                             | Have                          | `GET /api/documents`                                                                    |
| Get a document as `json` or `text`                                 | Have                          | `GET /api/documents/:documentId/content`                                                |
| Get a document as `yjs` or `base64`                                | Cut                           | A raw-update read would bypass fail-closed schema validation.                           |
| Get one named fragment, or several                                 | Cut                           | docs.plus has exactly one content fragment.                                             |
| Get a document at a past version                                   | Have                          | `GET .../versions/:version`                                                             |
| Duplicate a document                                               | Have, in one call             | `POST .../duplicate`. Tiptap needs a GET then a POST.                                   |
| Delete a document                                                  | Have, and richer              | Soft delete, trash listing, restore, permanent delete, purge.                           |
| Check existence with `HEAD`                                        | Cut                           | §11.                                                                                    |
| Apply a Yjs update with `PATCH`                                    | Have differently              | `PATCH .../content` takes JSON, in `replace` or `append`.                               |
| Batch import many documents                                        | Cut                           | §11.                                                                                    |
| Encrypt a document                                                 | Cut                           | §11.                                                                                    |
| Export and import a zip carrying every version                     | Cut                           | §11. The docs.plus `export` and `import` routes convert DOCX, Markdown and ODT instead. |
| Broadcast a stateless message over REST                            | Cut                           | §11. The collaboration process relays `docTitle` only, with a 64 KiB budget.            |
| Admin token with a named scope                                     | Have differently              | One service-role bearer, compared in constant time. No scopes.                          |
| 100 requests per 5 seconds per address, bursting to 200            | Have differently, far tighter | 100 per 15 minutes per address. See H6.                                                 |

## Content injection, parameter by parameter

This is the surface docs.plus deliberately built small. Tiptap exposes fourteen query parameters on one `PATCH`. docs.plus exposes two modes.

| Tiptap parameter                                             | docs.plus     | Reopens as                                                         |
| ------------------------------------------------------------ | ------------- | ------------------------------------------------------------------ |
| `format=json`                                                | Have          | —                                                                  |
| `format=binary`, `format=base64`                             | Cut           | —                                                                  |
| `mode=default`, meaning merge nodes                          | Cut in effect | H1                                                                 |
| `mode=append`                                                | Have          | —                                                                  |
| `mode=node`                                                  | Cut           | H1                                                                 |
| `mode=attrs`, with `mergeAttributes` and `multiUpdates`      | Cut           | H1                                                                 |
| `mode=delete`                                                | Cut           | H1                                                                 |
| `nodeAttributeName` and `nodeAttributeValue`                 | Cut           | H1, then H2 for the address itself                                 |
| `checksum`, plus the `x-<fragment>-checksum` response header | Cut           | H1b                                                                |
| `user`                                                       | **Ruled**     | Never. A service-role write carries the operation, never a person. |
| `skipVersioning`                                             | Cut           | —                                                                  |
| `upsert`                                                     | Cut           | —                                                                  |
| `fragment`, `multi`                                          | Cut           | —                                                                  |
| `GET` and `PATCH` on `.../fields`, for custom Yjs maps       | Cut           | — The document metadata map must never be caller-writable.         |

Two things are worth saying plainly. Tiptap's own page says node targeting only works on top-level nodes in the default mode, so its selector has the same limit docs.plus would hit. And Tiptap recommends its UniqueID extension to generate the address, which is the decision H2 has to make.

## Version history

| Tiptap capability                                        | docs.plus                       | Note                                                                                                                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Automatic versioning                                     | Have differently                | A browser edit mints a version on the persist debounce, ten seconds idle and sixty maximum. A REST write flushes at once instead, when its direct connection closes. There is no interval to set.                                                |
| Turn automatic versioning on or off at runtime           | Not a goal                      | Versioning is always on.                                                                                                                                                                                                                         |
| List versions                                            | Have                            | `GET .../versions`, and the `history.list` operation over the socket.                                                                                                                                                                            |
| Get one version                                          | Have                            | `GET .../versions/:version`                                                                                                                                                                                                                      |
| Create a named version, with metadata                    | Have over REST                  | `POST .../versions`. The manual Save-version button is cut: versioning stays automatic.                                                                                                                                                          |
| Rename a version, or edit its metadata                   | **Gap**                         | See T3.                                                                                                                                                                                                                                          |
| Delete a version                                         | Have                            | `DELETE .../versions/:version`                                                                                                                                                                                                                   |
| Revert to a version                                      | Have                            | `POST .../versions/:version/restore`, plus a pre-revert backup.                                                                                                                                                                                  |
| Preview a version without changing the document          | Have                            | Shipped in the history sidebar.                                                                                                                                                                                                                  |
| Version metadata naming the contributors and the trigger | Have partially                  | Change attribution shipped. REST operations write `triggeredBy: null`, which is the `user` cut above.                                                                                                                                            |
| Verify contributor identity against the signed token     | Same weakness, already recorded | Tiptap warns that its contributor list is client-supplied unless a setting is enabled. In docs.plus, `history.revert` is reachable by any writable connection, including an anonymous visitor's session. That hazard is accepted and documented. |

## Version comparison

| Tiptap capability                        | docs.plus        | Note                                                                                            |
| ---------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| Compare two versions and show a diff     | Have differently | A server diff at `GET .../versions/:version/diff`, and `buildCompareDecorations` in the editor. |
| Show and hide the diff view              | Have             | Shipped in the history sidebar.                                                                 |
| Customise how a diff maps to decorations | Not a goal       | `buildCompareDecorations` is ours and is not configurable.                                      |
| Attach user data to diff attribution     | **Ruled**        | Per-block authorship on API writes was decided against. Build nothing.                          |

## Metrics and health

| Tiptap capability                                                                                                                              | docs.plus                              | Note                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Server statistics over REST: document count, current and lifetime connections, loaded documents, open document names, connections per document | **Gap**                                | See T1.                                                                                        |
| Per-document statistics: current connections and connected addresses                                                                           | **Gap**                                | See T1.                                                                                        |
| Health endpoint returning a text body                                                                                                          | Have, and better                       | `/health`, plus `database`, `redis`, `supabase`, `push`, and a database-gated `/health/ready`. |
| Prometheus metrics                                                                                                                             | Have, and Tiptap does not document one | Internal listeners on ports 4003 and 4002, scraped by DNS discovery, with Grafana alert rules. |

## Runtime configuration

Tiptap exposes a settings store: `PUT`, `GET` and `DELETE` on `/api/admin/settings/:key`, changing behaviour with no restart.

docs.plus validates environment variables once at boot and exits non-zero when they are wrong. Nothing is adjustable at runtime.

| Tiptap setting                              | docs.plus                                                             |
| ------------------------------------------- | --------------------------------------------------------------------- |
| Rotate the signing secret or the API secret | Not a goal. Environment plus a redeploy.                              |
| Allowed origins                             | Have differently, through an environment variable.                    |
| Disable authentication                      | Not a goal, and should stay that way.                                 |
| The whole webhook family                    | **Gap.** See T2.                                                      |
| Automatic versioning defaults               | Not a goal. Always on.                                                |
| Versioning across every fragment            | Not applicable. One fragment.                                         |
| Token-scoped document access                | Not applicable. A different authentication model.                     |
| Skip the object-storage health check        | Not applicable. No such check exists.                                 |
| Comment thread authentication               | Not applicable. Comments are Supabase rows behind row-level security. |
| The settings store itself                   | **Gap.** See T4.                                                      |

## The four document-server gaps

These sit inside the document server, so they are smaller than the three product gaps above. They are candidates, not approved work. Do not copy them into `BACKLOG-hocuspocus-backend.md` without a ruling.

### T1 — No statistics over REST

Tiptap answers "how many people are in this document right now" over HTTP. docs.plus cannot.

**Recommendation: build almost none of it.** Prometheus already carries every server-level number, and live presence already carries the per-document answer to connected clients. The one number with no home is a list of connections per document, for an operator who is not in the document. The admin dashboard is where that belongs, not a public REST route.

### T2 — No outbound webhooks

This is the largest genuine gap, and the only one I would argue for.

Tiptap posts to a URL on document save, and on user connect and disconnect. docs.plus has the same events internally: `document:saved` rides the socket, and the store queue already knows when a save lands. Nothing leaves the system.

**Recommendation: worth a ruling.** An integration story is the reason to build it, and none is written yet. Note the shape carefully if it opens: an outbound call to a caller-supplied address is a request-forgery surface, and this codebase already carries two different guards for that problem.

### T3 — No way to rename a version

`POST .../versions` can name a version at creation. Nothing can rename it afterwards, or edit its metadata. Tiptap has `PATCH .../versions/:versionId`.

**Recommendation: cheap, and low value until someone asks.** The version row already carries a name column. Hold it until a real caller wants it.

### T4 — No runtime configuration

**Recommendation: do not build.** Single-tenant self-hosted software has environment variables and a redeploy. A settings store exists in Tiptap Cloud because it serves many customers who cannot restart each other's servers. That reason does not apply here.

## What this comparison does not change

Every cut above stays cut. This document is a survey of a neighbouring product, so it is not the new evidence that reopens a decision. Reopening the content-injection cuts still runs through H1, H1b, H1c and H2, and those rows already carry the argument and the cost.

Two findings reinforce work already tracked. Tiptap's warning that its contributor list is unverified describes the same class of weakness as the accepted `history.revert` hazard. And Tiptap's own rate limit is thirty times looser than the docs.plus limiter, which is worth knowing when H6 is answered.

## Sources

Read in full on 2026-08-19.

- [Document management API](https://tiptap.dev/docs/collaboration/documents/rest-api)
- [Inject content REST API](https://tiptap.dev/docs/collaboration/documents/content-injection)
- [Integrate snapshots](https://tiptap.dev/docs/collaboration/documents/snapshot)
- [Compare document versions](https://tiptap.dev/docs/collaboration/documents/snapshot-compare)
- [Server metrics and statistics](https://tiptap.dev/docs/collaboration/operations/metrics)
- [Runtime configuration](https://tiptap.dev/docs/collaboration/operations/configure)

The product table also draws on [Tiptap platform pricing](https://tiptap.dev/pricing), which enumerates the plans and the two paid add-ons, the [Q1 2026 release notes](https://tiptap.dev/blog/release-notes/recap-q1-2026) for Pages and the Convert Service, and the [2026 roadmap](https://tiptap.dev/blog/release-notes/our-roadmap-for-2026).

Local sources: `apps/hocuspocus.server/API.md` for the shipped surface, `RESEARCH-restapi-gaps.md` for the earlier gap study, `PROMPT-inject-content-rest-api.md` §11 for the cuts, and `BACKLOG-hocuspocus-backend.md` for the row ids.
