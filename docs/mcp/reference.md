# MCP connector reference

The docs.plus MCP connector for developers and agent builders: the endpoint, sign-in, tools, limits, and errors. MCP (Model Context Protocol) is an open standard that AI apps use to call tools outside the app. A host is the AI app, such as Claude or ChatGPT, that connects to docs.plus. docs.plus calls it a connected app. To connect a host step by step, see [Use docs.plus from Claude or ChatGPT](README.md).

[`apps/hocuspocus.server/API.md`](../../apps/hocuspocus.server/API.md#mcp-connector) owns the route contract, including the section and chat rules.

## Endpoint

| Item      | Value                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL       | `https://prodback.docs.plus/api/mcp`. On your own server, `<PUBLIC_RESTAPI_URL>/api/mcp`, after you [turn on the MCP connector](../self-hosting/configuration.md#turn-on-the-mcp-connector).                           |
| Transport | Streamable HTTP, stateless. Each request gets a new server, so nothing is held between requests.                                                                                                                       |
| Protocol  | Claude's and OpenAI's docs name the 2025 revisions, up to `2025-11-25`. [API.md](../../apps/hocuspocus.server/API.md#mcp-connector) calls these legacy. Only `2025-11-25` is tested, with the official MCP SDK client. |
| Origin    | A request whose `Origin` header is not on the server's allowed list gets `403`. Hosted apps call from their servers and send no `Origin` header.                                                                       |

Replace `<PUBLIC_RESTAPI_URL>` with your server's value of [`PUBLIC_RESTAPI_URL`](../../apps/hocuspocus.server/ENV.md).

## Authorization

- Supabase Auth is the authorization server, with OAuth 2.1. docs.plus runs no OAuth server of its own.
- A host registers itself with dynamic client registration (DCR). Supabase does not offer Client ID Metadata Documents (CIMD).
- The flow uses PKCE with `S256`. The consent page is `https://docs.plus/oauth/consent`. On your own server, it is your webapp address plus `/oauth/consent`.
- Send the token as `Authorization: Bearer <token>`. Replace `<token>` with the access token the host gets at the end of the OAuth flow. The `token` header that other REST routes read is ignored here.
- Only a token that carries a `client_id` claim is accepted. An OAuth grant adds that claim. A docs.plus browser session token never has it, so it gets `401`.
- On the docs.plus server, only `/api/mcp` accepts a token with `client_id`. [Authentication](../api/authentication.md#what-each-credential-can-call) says what the other routes do with it.
- The docs.plus Supabase project refuses a token with `client_id` too. The Data API (tables, RPC and GraphQL) answers `403` with the code `connected_app`. Storage shows the token no objects and refuses its uploads. Realtime refuses it on private channels, and applies the same refusal to database-change subscriptions. So build on the tools below, not on the Supabase APIs. A self-hosted server needs [one Supabase script](../self-hosting/configuration.md#turn-on-the-mcp-connector) for this.

**Audience binding is not possible today.** Supabase always sets `aud` to `authenticated`. It never writes the RFC 8707 `resource` into the token ([supabase/auth#2610](https://github.com/supabase/auth/issues/2610)). So `/api/mcp` cannot prove that a token was issued for it. The `client_id` rule is the strongest check Supabase allows.

**Revoking access.** A person disconnects an app in docs.plus **Settings > Connected apps**. The tab reads the person's grants with the Supabase `listGrants` call. **Disconnect** calls `revokeGrant` for each client. A host that uses DCR registers a new client on each fresh connection. So the tab groups clients by trust state and app name, and **Disconnect** revokes every client in the group. Trust follows each client's registered redirect URIs, which the tab reads from `GET /api/connected-apps/redirects`, never the name the app registered. The app's current token can still work at /api/mcp for up to one minute.

### Discovery

A request without a valid token gets `401` and this header.

```
WWW-Authenticate: Bearer resource_metadata="https://prodback.docs.plus/api/mcp/.well-known/oauth-protected-resource", scope="openid email profile"
```

When a token was sent, the header also carries `error="invalid_token"`. Hosts start sign-in from this header. The server asks hosts for `openid`, `email` and `profile` only, in `scope` here and in `scopes_supported` below.

The metadata sits under `/api/mcp`, not at the site root, because only `/api` and `/health` are routed publicly. It answers like this.

```json
{
  "resource": "https://prodback.docs.plus/api/mcp",
  "authorization_servers": ["https://tglymsfloxmouzjuoycu.supabase.co/auth/v1"],
  "bearer_methods_supported": ["header"],
  "resource_name": "docs.plus",
  "scopes_supported": ["openid", "email", "profile"]
}
```

`resource` must match the URL the person types into the host, with no `/` at the end.

## Tools

The server has 10 tools. Every tool except `find_documents` and `create_document` takes a document `slug`. Each tool runs as the signed-in person and checks access first. Reads follow the normal access rule. Writes and chat posts work only in documents the person owns.

A result carries text and `structuredContent`, with snake_case keys. Document and chat text is framed as data that people wrote, not instructions. The hints follow OpenAI's definitions. Read tools set `readOnlyHint: true`, `destructiveHint: false` and `openWorldHint: false`. Write tools set `openWorldHint: true`, because documents are public by default and a write publishes.

| Tool                 | Hints                       | What it does                                                                    | Inputs                                                                  |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `find_documents`     | read-only                   | Lists the person's documents, or searches public ones by title                  | `query`, `scope` (`mine` or `public`), `limit` (1 to 50)                |
| `create_document`    | not destructive, open world | Makes a new document the person owns. Returns its `slug` and `url`              | `title`, `markdown`                                                     |
| `get_outline`        | read-only                   | The heading tree, with a `section_id` and `rev` for each heading                | `slug`                                                                  |
| `read_document`      | read-only                   | The document as Markdown, or one section with its `rev` and numbered blocks     | `slug`, `section_id`, `max_chars`                                       |
| `append_to_document` | not destructive, open world | Adds Markdown at the end                                                        | `slug`, `markdown`                                                      |
| `edit_blocks`        | destructive, open world     | Inserts, replaces or removes whole blocks at a numbered position in one section | `slug`, `section_id`, `rev`, `after_block`, `remove_blocks`, `markdown` |
| `replace_text`       | destructive, open world     | Changes text inside one paragraph, list item or table cell                      | `slug`, `section_id`, `rev`, `old_text`, `new_text`                     |
| `list_chat_rooms`    | read-only                   | The headings that have a chat room                                              | `slug`                                                                  |
| `read_chat_thread`   | read-only                   | Messages in one heading's room, newest last                                     | `slug`, `section_id`, `before_seq`, `limit` (1 to 50)                   |
| `post_chat_message`  | not destructive, open world | Posts plain text in one heading's room, as the person                           | `slug`, `section_id`, `text`                                            |

`scope: "public"` needs a `query`. `find_documents` lists the most recently updated first, 20 by default. Its `updated_at` moves when the title or settings change, not on every text edit. So do not treat it as the time of the last text edit.

A `#` heading in written Markdown is refused, because it is the document title. The one exception is the first append to an empty document, which must start with its title.

`create_document` refuses an anonymous account. The `title` becomes the `#` heading, and `markdown`, if given, follows it. The Markdown is checked before anything is written, so refused text leaves no document. One transaction writes the document and version 1, so a failed write leaves none either. The slug comes from the title. A taken slug gets a suffix, and a slug that is a webapp page, such as `privacy`, gets `-document`. The new document is public, like any new docs.plus document. The `url` is the webapp address plus the slug.

**Editing inside a section.** An AI app changes only the blocks or text it names. It never changes a heading, and it never removes media. It reads one section with `read_document` and `section_id`, then edits there.

- A section read numbers each block after the heading: `[1]`, `[2]` and so on. A block is a paragraph, a list, a table, a quote or an embed. A picture sits inside a paragraph.
- `edit_blocks` puts a caret after block `after_block`, where `0` is right after the heading. It removes the next `remove_blocks` blocks, then inserts the Markdown there. `remove_blocks: 0` only inserts, and empty Markdown only removes.
- `edit_blocks` refuses to remove a block that holds a picture, a video, an embed, an upload in progress or a file link. An AI app sees media only as a placeholder, so it could never put the media back.
- A new heading must be deeper than the section heading, and it can go only at the end of the section. Anywhere else, it would move the blocks after it into a new subsection.
- `replace_text` refuses to remove the name of a file attachment, because the name carries the file link. It may add text next to it.
- `replace_text` finds `old_text` in the section body and puts `new_text` in its place. `old_text` must appear exactly once, inside one stretch of text. It cannot cross two blocks, a picture or a line break, and it never matches the heading. To insert, repeat the nearby words and add to them. To delete, leave `new_text` empty.
- `new_text` is plain text. It takes the formatting of the first character it replaces, so bold or a link around it stays. For new paragraphs or new formatting, use `edit_blocks`.
- Both tools check the section `rev`. `replace_text` returns the new `rev`, so a second text edit needs no new read. `edit_blocks` returns no `rev`: its edit renumbers the blocks after it, and an agent that reused its old numbers could remove the wrong block. So it must read the section again.
- `read_document` escapes Markdown characters, such as `snake\_case`. `replace_text` first looks for `old_text` as given, and if that finds nothing, it tries again with those escapes removed.

`post_chat_message` only adds a message, so it is not destructive. It reaches other people: room members who follow every message and are away get a notification. Every `@` is removed, so it never sends a mention or `@everyone` notification.

**Server instructions.** The `initialize` result carries `instructions`. They say that these tools act as the signed-in person, and that a browser session is not signed in as them. To start a document, they name `create_document`. To change one, they name `replace_text` and `edit_blocks`. A host may ignore them. The server info also carries `title`, `websiteUrl` and `description`.

## Limits

| Limit               | Value                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Read output         | 100 000 characters per call, or `max_chars` when smaller. The text says where it stopped.                                   |
| Markdown written    | 65 536 characters per call                                                                                                  |
| Chat post           | 2000 characters of text. The stored HTML is capped at 3000 characters.                                                      |
| Tool calls          | 60 per minute per person, on a server with Redis. Over it, the tool returns an error with the wait in seconds, not a `429`. |
| Request body        | 1 MiB. A larger body gets `413`.                                                                                            |
| REST API rate limit | The REST API [rate limit](../api/README.md#rate-limiting) also covers `/api/mcp`                                            |

A post with many short lines can pass the text cap and fail the HTML cap.

## Errors

| Where     | Answer                        | Cause                                                                                                                   |
| --------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Transport | `401` with `WWW-Authenticate` | No token, an invalid or expired token, or a token with no `client_id`                                                   |
| Transport | `403 FORBIDDEN`               | An `Origin` header that is not on the allowed list                                                                      |
| Transport | `413 PAYLOAD_TOO_LARGE`       | A body over 1 MiB                                                                                                       |
| Transport | `429 RATE_LIMIT_EXCEEDED`     | The REST API limit for one network address. Many people on one hosted app share it. Wait for the `Retry-After` seconds. |
| Transport | `503 AUTH_UNAVAILABLE`        | The server could not reach Supabase Auth. Retry with a backoff.                                                         |
| Tool      | A result with `isError: true` | The tool refused. The text gives the next step.                                                                         |

When one argument is at fault, the tool error text starts with that field, such as `slug:` or `section_id:`. An argument with the wrong shape never reaches the tool. The MCP SDK on the server refuses it and names the failing field.

Plan retries with care. `create_document`, `append_to_document`, `edit_blocks`, `replace_text` and `post_chat_message` are not idempotent.

- A stale `rev` is refused. Call `get_outline` or `read_document` again, then retry with the new `rev`.
- After `docs.plus could not confirm the write`, wait about a minute, then call `read_document` before you retry. A read at once cannot see a write that is still saving.
- After `docs.plus could not confirm the post`, call `read_chat_thread` before you retry.
- After any unclear `create_document` failure, call `find_documents` before you retry.
