# docs.plus documentation

Everything written for people who use, host, or build on docs.plus. If you want to change the code instead, start at [CONTRIBUTING.md](../CONTRIBUTING.md).

docs.plus is a real-time collaborative editor. A document is a tree of headings, and every heading carries its own chat thread.

## Run it on your own server

| Page                                           | Answers                                                        |
| ---------------------------------------------- | -------------------------------------------------------------- |
| [Requirements](self-hosting/README.md)         | What you must provide before you start, and which path to take |
| [Install](self-hosting/install.md)             | Clone to a working site, then check that it worked             |
| [Configuration](self-hosting/configuration.md) | Which file you edit, and which process reads it                |

## Call the API

| Page                                    | Answers                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| [API overview](api/README.md)           | Base URL, response shape, error codes, and rate limits        |
| [Authentication](api/authentication.md) | Which credential your call needs, and which header carries it |
| [Quickstart](api/quickstart.md)         | Create a document, write content, and read it back            |
| [WebSocket](api/websocket.md)           | Connect a Yjs client to a document room                       |

The full route-by-route contract is [`apps/hocuspocus.server/API.md`](../apps/hocuspocus.server/API.md). The pages above cover the parts you need first, and link to it for the rest.

## Elsewhere in this repository

| Page                                                              | Answers                                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| [CONTRIBUTING.md](../CONTRIBUTING.md)                             | How to set up a local stack and open a pull request               |
| [extensions/README.md](../extensions/README.md)                   | The five Tiptap extensions docs.plus publishes to npm             |
| [SECURITY.md](../SECURITY.md)                                     | How to report a vulnerability. Do not open a public issue for one |
| [CONTEXT.md](../CONTEXT.md)                                       | The domain glossary: what each term in this project means         |
| [apps/hocuspocus.server/ENV.md](../apps/hocuspocus.server/ENV.md) | Every backend environment variable, its type, and its default     |

## Decision records

Why one piece of the architecture is the way it is. Each record states the decision, the alternatives, and what it cost.

- [0001 — document swarm](adr/0001-document-swarm.md)
- [0002 — mobile chat pane](adr/0002-mobile-chat-pane.md)

## Conventions

Every page here follows the same rules, so a reader and a coding agent both get the same facts.

- Each page opens with one line stating what it covers and what it does not.
- Every command sits in a fenced block, and states the directory it runs in.
- A value you must replace looks like `<THIS>`. A line under the block says where to get it.
- Every environment variable is defined on exactly one page.
- Commands use `bun`, `bunx`, or `make`. This repository never uses npm, yarn, pnpm, or npx.
