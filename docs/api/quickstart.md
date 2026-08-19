# Quickstart

Create a document, write content into it, and read it back. Three calls, from a server. For the credential these calls need, see [Authentication](authentication.md).

This page uses the service-role key, because writing content requires it. Run these from a backend, never from a browser.

## Before you start

You need two values.

- `<BASE_URL>` — where the REST API answers. Locally that is `http://localhost:4000`.
- `<SUPABASE_SERVICE_ROLE_KEY>` — the service-role key from your Supabase project settings.

## 1. Create a document

```bash
curl -X POST '<BASE_URL>/api/documents' \
  -H 'Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Quarterly report",
    "slug": "quarterly-report"
  }'
```

`title` and `slug` are required. The slug is normalised, and the server generates a 19-character `documentId`.

```json
{
  "success": true,
  "data": {
    "documentId": "kR4pZ2mQ7tY1nB8xW3v",
    "slug": "quarterly-report"
  }
}
```

**Keep that `documentId`.** Every content call addresses a document by id, never by slug. A taken slug returns `409` rather than being renamed quietly.

You can also seed content in this one call, by adding a `content` field holding a Tiptap document. That field is accepted only under the service-role key, and it lands as version 1.

## 2. Write content

```bash
curl -X PATCH '<BASE_URL>/api/documents/<DOCUMENT_ID>/content?mode=replace' \
  -H 'Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": {
      "type": "doc",
      "content": [
        {
          "type": "heading",
          "attrs": { "level": 1 },
          "content": [{ "type": "text", "text": "Quarterly report" }]
        },
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Revenue grew 12%." }]
        }
      ]
    }
  }'
```

Replace `<DOCUMENT_ID>` with the id from step 1.

Two modes exist. `replace` swaps the whole body, and it is the default. `append` adds your top-level nodes after the existing ones.

A `200` means the content reached the live document, and its save was handed off. People with the document open see the change at once, without reconnecting.

## 3. Read it back

```bash
curl '<BASE_URL>/api/documents/<DOCUMENT_ID>/content?format=json' \
  -H 'Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>'
```

```json
{
  "success": true,
  "data": {
    "documentId": "kR4pZ2mQ7tY1nB8xW3v",
    "version": 12,
    "format": "json",
    "content": {
      "type": "doc",
      "content": [
        {
          "type": "heading",
          "attrs": { "level": 1, "toc-id": "a1B2c3D4e5F6g7H8" },
          "content": [{ "type": "text", "text": "Quarterly report" }]
        }
      ]
    }
  }
}
```

Pass `format=text` instead to get plain text, one line per block.

Notice the `toc-id` the server added. That is covered below.

**This read returns the stored copy, not the live one.** It can trail an actively edited document by up to 60 seconds. Your own write is different — it flushes immediately, so you do not wait for that window when you verify your own change.

A document that exists with no content yet returns `version: 0` and an empty document. That is not an error.

## Content rules that cause a 422

A `422` here usually means valid JSON that breaks a document rule, not a malformed body.

**The first node must be a level-1 heading.** A document without one is refused. Otherwise the editor would invent a title on first open and save a heading you never wrote.

**An image is inline.** Put it inside a `paragraph` or a `heading`. An image at the top level is refused.

**The root array is flat.** A heading holds inline text only. The blocks that follow a heading are its siblings, not its children.

Three caps also apply: 5 MiB per payload, 50,000 nodes, and a nesting depth of 100.

## About toc-id

Headings and tables carry a `toc-id`. The server assigns one wherever it is missing. That id is the address a heading's chat thread, its fold state, and its `?id=` deep link all hang off.

**Round-trip the ids.** When you `GET` a document, edit it, and `replace` it, send the existing `toc-id` values back. Drop them and every heading gets a new address, which detaches its chat thread.

**On `append`, a duplicate id is permanent.** The server de-duplicates within one payload only, and never reads the live document's ids. So if you send an id a heading already owns, both headings end up sharing one chat thread and one anchor. Next step: omit `toc-id` on `append` and let the server mint one, or `GET` first and avoid the ids already in use.

## Writing a lot of content

Every `PATCH` stores a full version of the document. So 500 small writes leave roughly 500 stored versions.

The rate limit is also low, at 100 requests per 15 minutes per address by default.

Next step: prefer one `replace`, or a few large `append` calls, over many small ones. If you are importing a long document, build the whole Tiptap document first and send it once.

## Retrying safely

`replace` is safe to retry. Sending it twice leaves the same document.

`append` is not. A timeout may mean the write landed anyway, so a blind retry can append twice. Next step: `GET` the document and check before retrying an `append`.

A repeated `500` on the same document means server-side persistence is stuck for it. Next step: stop retrying and tell an operator, because each attempt keeps changing what people see without saving it.

## Where to go next

- [Authentication](authentication.md) — the other two credential types, and what each one can call.
- [WebSocket](websocket.md) — to watch a document change in real time instead of polling.
- [`apps/hocuspocus.server/API.md`](../../apps/hocuspocus.server/API.md) — versions, export and import, media, and link metadata.
