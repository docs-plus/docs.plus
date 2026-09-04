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

Note that a user token rides in a `token` header, not in `Authorization`. That is unusual, and it is what most first integrations get wrong.

## Keep the service-role key on a server

The service-role key passes every document, public and private. It is not scoped, and it cannot be narrowed. Treat it the way you treat a database password.

Never ship it to a browser, a mobile application, or any client you do not control. Next step: put every service-role call behind your own backend, and let your backend hold the key.

## What each credential can call

**No credential needed.** The health paths, `GET /api/metadata`, reading one media file, and the email unsubscribe pages.

**A user token, optional.** Listing documents without an owner filter, reading one document by slug, and updating document metadata. Sending a token here changes what you see rather than whether the call works.

**A user token, required.** Listing your own documents, creating a document, the whole document lifecycle — delete, restore, duplicate, favorite or unfavorite, Last opened (`POST /api/documents/:documentId/opened`), permanently delete, empty the trash. Uploading media also requires a user token.

**Service-role only.** Reading and writing document content, every document version route, the email routes, and the `content` and `ownerId` fields when creating a document.

**Either a user token or the service-role key.** Export and import. The key passes every document; a user token is checked against that document's privacy and lock.

**An admin token.** Everything under `/api/admin/`.

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
