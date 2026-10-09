# Authentication

Which credential your call needs, which header carries it, and which calls a browser can never make. For the base URL and the response shape, see [API overview](README.md).

This page covers the REST API. For the collaboration socket, see [WebSocket](websocket.md).

## Three credentials

docs.plus authenticates against your own Supabase project. There is no separate docs.plus account system, and there are no API keys to mint.

| Credential        | Where it comes from                                   | Header                                              |
| ----------------- | ----------------------------------------------------- | --------------------------------------------------- |
| User access token | Supabase Auth, after a person signs in                | `token: <jwt>`                                      |
| Service-role key  | Your Supabase project settings                        | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` |
| Admin token       | A user token whose subject has a row in `admin_users` | `Authorization: Bearer <jwt>`                       |

Replace `<jwt>` with the access token Supabase returns for a signed-in user. Replace `<SUPABASE_SERVICE_ROLE_KEY>` with the service-role key from your Supabase project settings.

A connected app, such as Claude or ChatGPT, holds a fourth kind of token, for `/api/mcp` only. See [What each credential can call](#what-each-credential-can-call).

Note that a user token rides in a `token` header, not in `Authorization`. That is unusual, and it is what most first integrations get wrong.

## Keep the service-role key on a server

The service-role key passes every document, public and private. It is not scoped, and it cannot be narrowed. Treat it the way you treat a database password.

Never ship it to a browser, a mobile application, or any client you do not control. Next step: put every service-role call behind your own backend, and let your backend hold the key.

## What each credential can call

**No credential needed.** The health paths, `GET /api/metadata`, reading one media file, the email unsubscribe pages, and `POST /api/email/validate`.

The unsubscribe link carries its own `token`, and that token is its only credential. A `GET` of the link checks the token and shows a confirm page. It changes nothing, so a mail link scanner cannot unsubscribe a reader. The page's button posts `confirm=yes` and gets an HTML result. Any other `POST` body is the RFC 8058 one-click post from a mail client, and it gets JSON.

**A user token, optional.** Listing documents without an owner filter, reading one document by slug, and updating document metadata. Sending a token here changes what you see rather than whether the call works.

**A user token, required.** Listing your own documents, creating a document, the whole document lifecycle — delete, restore, duplicate, favorite or unfavorite, Last opened (`POST /api/documents/:documentId/opened`), permanently delete, empty the trash. Uploading media also requires a user token.

**Service-role only.** Reading and writing document content, every document version route, the service-role email send, preview and bounce routes, and the `content` and `ownerId` fields when creating a document.

**A Resend webhook signature.** `POST /api/email/webhooks/resend` takes no key and no token. Resend signs each request with the endpoint's `whsec_` secret, and the server checks the `svix-signature` header. The route exists only when the server sets a valid `RESEND_WEBHOOK_SECRET`.

**Either a user token or the service-role key.** Export and import. The key passes every document; a user token is checked against that document's privacy and lock.

**An admin token.** Everything under `/api/admin/`.

**A connected app's token.** A token that carries a `client_id` claim comes from a connected app, such as Claude or ChatGPT. On this API, only `/api/mcp` accepts it, described in [MCP connector reference](../mcp/reference.md). It is sent as `Authorization: Bearer`, not in the `token` header. A route that requires a user token answers `403`, and so does `/api/admin/`. A route where a token is optional treats the caller as signed out. The WebSocket refuses the connection.

## One rule that surprises people

**Media upload refuses the service-role key.** Uploading requires a verified user, and the key is not a user token, so the server cannot resolve a person from it. A service-role caller therefore cannot upload media at all today.

Next step: if you are automating media, upload through a real signed-in account, and follow issue [#167](https://github.com/docs-plus/docs.plus/issues/167) for the decision on changing this.

## What failure looks like

| Status | Code               | Cause                                                   |
| ------ | ------------------ | ------------------------------------------------------- |
| `401`  | `UNAUTHORIZED`     | No credential, or one the server could not verify       |
| `403`  | `FORBIDDEN`        | A valid credential that is not allowed to do this       |
| `503`  | `AUTH_UNAVAILABLE` | The server could not reach Supabase to check your token |

`AUTH_UNAVAILABLE` is not a rejection. Your token may be valid and the check itself failed. Next step: retry with a backoff, and do not treat it as a sign-out.

## Private documents are owner-only

A private document admits its owner and nobody else. An anonymous visitor and a signed-in non-owner are both refused, and so is every request when the owner is not yet set on the row.

The refusal carries a hint at the top level of the body, beside the error, so a client can choose the right prompt.

```json
{
  "success": false,
  "error": { "code": "FORBIDDEN", "message": "..." },
  "access": "sign-in-required"
}
```

`access` is `sign-in-required` when signing in could help, and `denied` when it cannot.

**The service-role key does not open a private document by slug.** That route enforces the owner gate and ignores the key. So an automation cannot discover a private document from its slug. Next step: capture the `documentId` when you create the document, and store it. For a document that already exists, its owner has to read it and hand you the id.
