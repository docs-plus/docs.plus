# extension-hypermultimedia E2E

Clean-room Cypress suite against `test/playground/main.ts` via `@docs.plus/playground` (`docs-playground` on port 5174). Loads built `dist/` like an npm consumer.

## Release gate (five pillars)

| Pillar             | Spec                                                                         | What it proves                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paste**          | `paste/paste-matrix.cy.ts`                                                   | Media URL → node (not link); clipboard **image file** → blob `image` node via `editorFileUpload`; generic URLs autolink                                                      |
| **Toolbar UI**     | `toolbar/toolbar.cy.ts`                                                      | Hover/click opens one toolbar; placement + margin write attrs                                                                                                                |
| **Resize gripper** | `resize/gripper.cy.ts`                                                       | Decoration on image/embed nodes; 8-handle activation; side/corner drag → attrs; min-size floor; click-outside dismiss; Escape mid-drag snaps back and commits nothing        |
| **Loading shell**  | `loading/media-loading-shell.cy.ts`                                          | Reserved-size shimmer on insert/paste; provider label; pending → ready; `loadingShell=false` opt-out via `?loadingShell=false`                                               |
| **Serialization**  | `serialization/serialize-media.cy.ts`, `serialization/html-round-trip.cy.ts` | `getHTML()` never throws with video/audio nodes; setContent round-trip for all nine nodes under the default schema; hyperlink hrefs survive; toolbar Copy serializes cleanly |
| **Markdown**       | `markdown/markdown-round-trip.cy.ts`                                         | `@tiptap/markdown` full round-trip for all nine nodes via `![type](url)`; command export parity; caption/dimension edge cases; hyperlink coexistence                         |

## Supporting specs

| Area        | Specs                                                                                                                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nodes       | `nodes/insert-nodes.cy.ts`, `nodes/nested-context.cy.ts` (gripper + toolbar stay aligned to media inside blockquote / list items)                                                                                                                                             |
| Resize      | `resize/resize-stale-pos.cy.ts` (drag commit after edits above the node), `resize/resize-undo.cy.ts` (attr + rendered size revert and redo)                                                                                                                                   |
| Undo        | `paste/paste-undo.cy.ts` (pasted embed / image-file undo leaves no loading-shell orphan)                                                                                                                                                                                      |
| Stickiness  | `toolbar/toolbar-stickiness.cy.ts` (toolbar + active gripper follow the image anchor on scroll)                                                                                                                                                                               |
| Delete keys | `delete/delete-collision.cy.ts` (focused text caret keeps Backspace; Backspace after an image deletes only the image)                                                                                                                                                         |
| Lifecycle   | `lifecycle/editor-destroy.cy.ts` (destroy with controls open tears down everything; re-init on the same element works), `lifecycle/x-embed-mount.cy.ts` (X mount abort + fluid height after ready)                                                                            |
| Toolbar     | `toolbar/caption.cy.ts` (caption authoring + delete-key guards), `toolbar/registry.cy.ts` (action registry), `toolbar/x-embed.cy.ts` (X size/theme presets), `toolbar/touch-tap.cy.ts` (coarse-pointer tap opens controls without hover; touch pointerdown outside dismisses) |
| Security    | `security/loom-parse-s1.cy.ts`, `security/x-parse-s2.cy.ts` (runs with `?blockquote=off` so rejected twitter-tweet markup falls through to nothing), `security/x-oembed-s3.cy.ts`, `security/x-oembed-fallback.cy.ts`                                                         |
| Guards      | `guards/invalid-urls.cy.ts`                                                                                                                                                                                                                                                   |
| Embeds      | `embeds/vimeo-soundcloud.cy.ts`                                                                                                                                                                                                                                               |
| Globals     | `window/is-media-url.cy.ts`                                                                                                                                                                                                                                                   |

Run: `bun run test` from this package (`pretest` build → playground → Cypress).

README hero screenshots: see [CONTRIBUTING.md](../../CONTRIBUTING.md).
