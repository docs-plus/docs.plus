# Migrating from 1.x

Part of the [`@docs.plus/extension-hypermultimedia` README](../README.md).

Version 2.0.0 renames the Twitter node to X, renames the stored node types to camelCase, and drops the tippy modal API. Four kinds of change need your attention.

## Imports, options and commands

| 1.x                 | 2.0.0                                 |
| ------------------- | ------------------------------------- |
| default export      | named export `{ HyperMultimediaKit }` |
| `Twitter` (kit key) | `X`                                   |
| `setTwitter`        | `setX`                                |
| `TwitterOptions`    | `XOptions`                            |

Every other kit key keeps its name. `XOptions` is a source-level interface, and the package entry does not export it. Reach the kit shape through `HyperMultimediaKitOptions`. See [Removed API](#removed-api) for the attributes and options that are gone.

## Removed API

`createFloatingToolbar`, `hideCurrentToolbar`, the `imageModal`, `youtubeModal` and `twitterModal` exports, and the per-node `modal` option are gone. The media toolbar is built in. Pass [`mediaToolbar`](./media-toolbar.md#bring-your-own-toolbar) only to render your own surface. Also removed: `ImageNodeOptions.toolbar`, the `ImageToolbarFunction` type, the `transform` image attribute, and the audio `volume` option.

## Stored node types

| 1.x          | 2.0.0        |
| ------------ | ------------ |
| `Image`      | `image`      |
| `Video`      | `video`      |
| `Audio`      | `audio`      |
| `Youtube`    | `youtube`    |
| `Vimeo`      | `vimeo`      |
| `SoundCloud` | `soundcloud` |
| `Twitter`    | `x`          |

The `loom` and `spotify` nodes are new in 2.0.0, so no `1.x` document holds them.

## Behavior differences

- The media toolbar moved from a floating popover, with placement buttons and a margin select, into the node's top-right corner. A declarative action registry drives it — see [Customizing actions](./media-toolbar.md#customizing-actions).
- Alignment follows the wrap vocabulary: Left, Center, Right, Wrap left, Wrap right.
- The kit no longer ships tippy.js. Floating UI positions every popover and tooltip. The kit bundles the popover engine and the tooltip engine into `dist`.

## Running the migration

docs.plus and Hocuspocus hosts: run `bun run --filter @docs.plus/hocuspocus migrate:media-node-names`, and preview it first with `:dry`.

External adopters: rewrite the stored JSON and Yjs node `type` strings yourself. The [media-node-rename runbook](https://github.com/docs-plus/docs.plus/blob/main/apps/hocuspocus.server/docs/migrate-media-node-names.md) lists every mapping, even if you never run the CLI.

The [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hypermultimedia/CHANGELOG.md) holds the full breaking-change list.
