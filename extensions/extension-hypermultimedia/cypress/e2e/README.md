# extension-hypermultimedia E2E

Clean-room Cypress suite against `test/playground/` (Bun server on port 5174). Loads built `dist/` like an npm consumer.

## Release gate (three pillars)

| Pillar             | Spec                                | What it proves                                                                                                                 |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Paste**          | `paste/paste-matrix.cy.ts`          | Media URL → node (not link); clipboard **image file** → blob `image` node via `editorFileUpload`; generic URLs autolink        |
| **Toolbar UI**     | `toolbar/toolbar.cy.ts`             | Hover/click opens one toolbar; placement + margin write attrs; scroll stickiness                                               |
| **Resize gripper** | `resize/gripper.cy.ts`              | Decoration on image/embed nodes; 8-handle activation; side/corner drag → attrs; min-size floor; click-outside dismiss          |
| **Loading shell**  | `loading/media-loading-shell.cy.ts` | Reserved-size shimmer on insert/paste; provider label; pending → ready; `loadingShell=false` opt-out via `?loadingShell=false` |

## Supporting specs

| Area        | Specs                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Node insert | `nodes/insert-nodes.cy.ts`                                                                                         |
| Security    | `security/loom-parse-s1.cy.ts`, `x-oembed-s3.cy.ts` (`x-parse-s2` skipped — StarterKit blockquote wins in harness) |
| Guards      | `guards/invalid-urls.cy.ts`                                                                                        |
| Embeds      | `embeds/vimeo-soundcloud.cy.ts`                                                                                    |
| Globals     | `window/is-media-url.cy.ts`                                                                                        |

Run: `bun run test` from this package (`pretest` build → playground → Cypress).
