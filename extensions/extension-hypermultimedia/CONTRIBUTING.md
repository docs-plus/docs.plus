# Contributing to `@docs.plus/extension-hypermultimedia`

## Tests

Clean-room Cypress E2E runs against the built `dist/` — the same bytes an npm consumer installs. `docs-playground` (from `@docs.plus/playground`) serves the page shell on port 5174; this package commits only the editor fixture (`test/playground/main.ts`) and a one-line `tsconfig.json`. The fixture also loads `@docs.plus/extension-hyperlink` from `dist/` so paste/autolink collision specs match production wiring.

```sh
bun run test            # build, then Cypress headless
bun run test:e2e        # Cypress headless against the current dist/ (run build first)
bun run test:e2e:watch  # same, but opens the Cypress runner
bun run playground      # playground only, http://127.0.0.1:5174
bun run docs:screenshots # regenerate README gallery PNGs in assets/
```

`docs:screenshots` builds hyperlink first, serves `assets/readme-media/` at `/readme-media/*`, then overwrites `assets/*.png`.

Capture flow (`runGalleryScene`): wait for `data-hm-loading="ready"` → hover toolbar (+ gripper except X) → screenshot. Default Cypress test isolation — each `it` calls `visitPlayground`. Settle/decode constants: [cypress/docs/readmeMedia.ts](./cypress/docs/readmeMedia.ts). Video/audio require `readyState >= README_MEDIA_HAVE_CURRENT_DATA`; video also needs `videoWidth > 0`. Loom uses `README_GALLERY_LOOM_READY_TIMEOUT_MS` for the loading shell and `README_GALLERY_LOOM_SETTLE_MS` after ready (timeout ≠ post-ready settle). X uses real oEmbed + `widgets.js` with `theme` on `setX`, then `README_GALLERY_X_WIDGETS_SETTLE_MS`. Scene table: [readme-gallery.cy.ts](./cypress/docs/readme-gallery.cy.ts). Media licenses: [ATTRIBUTION.md](./assets/readme-media/ATTRIBUTION.md).

### Adding a README gallery node

When you add or change a node type shown in the README **Gallery** section, update all of:

1. **`cypress/docs/readmeMedia.ts`** — public URL or local asset path, layout constants, embed opts (e.g. `README_LOOM_GALLERY_OPTS`). Loom embed id is derived from `README_LOOM` via `getLoomVideoId`.
2. **`cypress/docs/readme-gallery.cy.ts`** — one entry in `GALLERY_SCENES` (`slug`, `scope`, `setup`, `ready`, settle ms).
3. **`assets/<slug>-light.png` and `assets/<slug>-dark.png`** — regenerate via `bun run docs:screenshots`.
4. **`README.md`** — `<details>` / `<picture>` block under **Gallery** (static HTML only; no JS carousels). Copy an existing block and swap `slug`, summary label, and `alt` — paths follow `assets/<slug>-{light,dark}.png`.

Hero preview uses slug `preview` (image node, loading shell off). Keep gallery width/layout constants in `readmeMedia.ts`, not duplicated in the spec.

The playground accepts query-string flags so specs can exercise opt-in behaviors without forking the bootstrap:

| Flag                  | Effect                                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| `?loadingShell=false` | `loadingShell: false` on `HyperMultimediaKit` — no shimmer on insert      |
| `?uploaded=true`      | `isUploadedMedia: () => true` — toolbar upload affordances in specs       |
| `?blockquote=off`     | Disables StarterKit `blockquote` so X's parse rule wins in security specs |

Spec scope — release gate plus supporting areas — lives in [cypress/e2e/README.md](./cypress/e2e/README.md).

## Real-device tap checklist

`toolbar/touch-tap.cy.ts` pins the synthetic layer. Coarse-pointer hover gating, scroll interference during touch drags, and in-frame embed tap handling only show up on hardware — verify on iOS Safari and Android Chrome both:

1. Tap an image — the media toolbar and resize gripper appear; no caret, no keyboard.
2. Tap outside the image — toolbar and gripper dismiss.
3. Touch-drag a gripper clamp — the image resizes and the page does not scroll mid-drag (`touch-action: none` on the gripper).
4. Tap a toolbar action (align, `…` overflow) — the submenu opens on the first tap, no double-tap delay.
5. Tap a YouTube/Vimeo embed — playback controls respond in-frame. Embeds have no touch entry point to the toolbar today (hover is desktop-only; tap deliberately skips interactive embeds) — confirm, and decide whether one is needed.

## Development

```sh
bun install      # from the repo root
bun run build    # tsup → dist/ (ESM + CJS + d.ts + styles.css)
bun run dev      # tsup --watch
bun run typecheck
```

ESLint: from repo root, `bun run lint` (cascades into this package).

The suite also runs from the repo root via `bun run test`, alongside the other extension and webapp suites.
