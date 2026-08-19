# docs.plus API

The base URL, the response shape, the error codes, and the rate limit. Read this once, then go to [Quickstart](quickstart.md) to make your first call. For the credential your call needs, see [Authentication](authentication.md).

This page does not list every route. The full route-by-route contract is [`apps/hocuspocus.server/API.md`](../../apps/hocuspocus.server/API.md).

## Base URL

The REST API is one process, and it listens on port `4000`.

```
http://localhost:4000
```

On a self-hosted deployment it sits behind your reverse proxy. Only two path prefixes are routed to the public edge, `/api` and `/health`. Everything else answers inside your network only.

## Machine-readable spec

The same surface is published as OpenAPI 3.1 at `GET /openapi.json`, with a browsable page at `GET /docs`. Request schemas are generated from the live validation schemas, so they cannot drift from what the server accepts.

Neither path is routed publicly by default. Both answer in a local or internal environment. Publishing them is a proxy routing change, not a code change.

Use the spec for request and response shapes. Use these pages for behaviour: what a status code guarantees, whether a call is safe to retry, and what one write costs.

## Response shape

A successful call returns the payload under `data`.

```json
{
  "success": true,
  "data": {
    "documentId": "kR4pZ2mQ7tY1nB8xW3v",
    "version": 12
  }
}
```

An error returns a message and a code under `error`.

```json
{
  "success": false,
  "error": {
    "message": "Document not found",
    "code": "NOT_FOUND"
  }
}
```

`error.details` appears only when the server runs with `NODE_ENV=development`. Do not depend on it.

Three route groups still answer with older shapes, and the contract document lists each one. Notably `/api/metadata` puts `code` and `message` at the top level rather than nested. Next step: read the response-envelope section of the contract document before you write a client that parses errors.

## Error codes

| Status | Code                              | Meaning                                                  |
| ------ | --------------------------------- | -------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`, `BAD_REQUEST` | The request body or a parameter failed validation        |
| `401`  | `UNAUTHORIZED`                    | No credential, or one the server could not verify        |
| `403`  | `FORBIDDEN`                       | A valid credential that is not allowed to do this        |
| `404`  | `NOT_FOUND`                       | No such document, or it was deleted                      |
| `409`  | `CONFLICT`                        | The slug is taken, or the document already exists        |
| `413`  | `PAYLOAD_TOO_LARGE`               | Over a size cap                                          |
| `415`  | `UNSUPPORTED_MEDIA_TYPE`          | A file type the converter refuses                        |
| `422`  | `UNPROCESSABLE_ENTITY`            | Valid syntax, but the content breaks a contract rule     |
| `429`  | `RATE_LIMIT_EXCEEDED`             | Over the rate limit                                      |
| `500`  | `INTERNAL_SERVER_ERROR`           | An unhandled failure                                     |
| `503`  | `SERVICE_UNAVAILABLE`             | A dependency is down                                     |
| `503`  | `AUTH_UNAVAILABLE`                | The server could not reach Supabase to verify your token |

`AUTH_UNAVAILABLE` is worth handling separately. It means your credential may be fine and the check itself failed, so a retry can succeed. Next step: retry it with a backoff, and do not sign the user out.

A `422` on a content write usually means a contract rule, not a malformed body. The three that catch people are covered in [Quickstart](quickstart.md).

## Rate limiting

One limiter covers every request except `/health` and `/health/*`.

- The limit is `RATE_LIMIT_MAX` requests per 15 minutes, and the default is `100`.
- The key is the client address alone. The user agent is not part of it.
- There is no separate allowance for a service-role caller.

Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. A `429` also carries `Retry-After`, in seconds.

Two behaviours to plan for. A request that arrives with neither `x-forwarded-for` nor `x-real-ip` skips the limiter, which is why a direct local call is never limited. And when Redis is unavailable the limiter passes every request rather than refusing them.

The limit is low for bulk work. Next step: prefer one large write over many small ones, and read [Quickstart](quickstart.md) before importing.

## Health

Each of these returns `200` when healthy and `503` otherwise. None is rate limited.

| Path                   | Reports                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `GET /health`          | Overall status. Answers `200` while a non-critical dependency is degraded |
| `GET /health/database` | PostgreSQL                                                                |
| `GET /health/redis`    | Redis                                                                     |
| `GET /health/supabase` | Supabase                                                                  |
| `GET /health/push`     | The web-push gateway                                                      |

Use `GET /health` for a load-balancer check. Next step: if you need a stricter gate, read the health section of the contract document, because the collaboration process has a separate database-gated path.

## What is not a public API

Some routes exist and are not for you to call. Building against one will break.

- The internal listener on port `4003`. It carries service-role write endpoints and is never routed publicly.
- `GET /metrics`. It is a Prometheus endpoint, and it is unrouted rather than authenticated.
- `/api/admin/*`. The admin dashboard is the only intended client.
- The email routes. Normal delivery runs through a queue, not over HTTP.
