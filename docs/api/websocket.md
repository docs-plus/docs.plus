# WebSocket

How to connect a Yjs client to a document room, and what the server checks when you do. For the REST surface, see [API overview](README.md).

This page covers connecting and access. It does not describe the wire protocol, which is Hocuspocus and is documented upstream.

## What it is

The collaboration process listens on port `4001` and speaks the Hocuspocus protocol over Yjs. It is how the editor stays in sync, and it is a separate process from the REST API on port `4000`.

Use it when you want live changes. Use the REST content routes when you want to read or write once from a server.

## Connect

```ts
import { HocuspocusProvider } from '@hocuspocus/provider'

const provider = new HocuspocusProvider({
  url: 'ws://localhost:4001',
  name: '<DOCUMENT_ID>',
  token: JSON.stringify({
    accessToken: '<jwt>',
    slug: '<SLUG>',
    deviceType: 'desktop'
  })
})
```

Three values to replace. `<DOCUMENT_ID>` is the 19-character id from a document read or a create call — see [Quickstart](quickstart.md). `<jwt>` is the access token Supabase Auth returns for a signed-in person. `<SLUG>` is that document's slug.

Install the provider with Bun:

```bash
bun add @hocuspocus/provider yjs
```

## The room name is the document id

`name` is the room, and it must be the `documentId`. It is not the slug.

The token also carries a `slug`, and the server uses it for context only. Authorisation reads the room name, never the id inside the token. So a client cannot reach another document by changing the token.

Next step: resolve the id once through `GET /api/documents/<SLUG>` and store it. Do not derive a room name yourself.

## Anonymous connections

A public document accepts a connection with no token at all. That is deliberate — it is how a visitor reads and edits a public document without signing in.

Send a token when you have one. It is what gives the change an author, so version history can name who wrote what.

## Private documents admit the owner only

When a document is private, only its owner may connect. An anonymous visitor is refused, and so is a signed-in person who does not own it.

Two edge cases behave the way a careful reader would want, and both are intentional.

A private document whose owner is not yet set refuses everyone. And when the server cannot look the document up, it refuses rather than assuming the document is public. Next step: treat a refusal as final, and do not retry it as though it were a network error.

## Read-only documents

When a document is marked read-only and you are not its owner, the connection is accepted and marked read-only. You receive changes and your writes do not apply.

Next step: check the document's `readOnly` flag through the REST metadata read, so your interface can disable editing before somebody types.

## Ports, and what not to connect to

| Port   | Process              | For you?                   |
| ------ | -------------------- | -------------------------- |
| `4000` | REST API             | Yes                        |
| `4001` | Collaboration socket | Yes                        |
| `4002` | Worker health        | No                         |
| `4003` | Internal listener    | No — never routed publicly |

Port `4003` carries service-role write endpoints and metrics. Only network isolation protects it. Next step: never expose it through a reverse proxy.

## Where to go next

- [Quickstart](quickstart.md) — resolve a `documentId` and write content over REST.
- [Hocuspocus documentation](https://tiptap.dev/hocuspocus/introduction) — the wire protocol and the provider options.
