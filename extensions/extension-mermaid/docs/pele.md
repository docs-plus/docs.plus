# About Pele

Part of the [`@docs.plus/extension-mermaid` README](../README.md).

## What Pele is

Pele turns Mermaid text into SVG. The facts below come from the `pele@1.7.0` package and its README.

- Its `render()` call is synchronous.
- It has no runtime dependencies and its own layout engine.
- It themes through CSS variables named `--pele-*`.
- It detects 33 diagram types, listed in `dist/detect.d.ts`.
- It targets Mermaid 12.1.0 syntax, with its own layout and visual style.
- It is MIT licensed.

## How this package uses it

- The package lists `pele` in `dependencies` pinned to exactly `1.7.0`. npm installs it with the extension. Each family release moves the pin on purpose, because Pele changes fast.
- The only import of Pele is a dynamic `import('pele/lazy')` in one folder, `src/renderer/`. Pele loads on demand, and one chunk loads per diagram type.
- The package never imports Pele's main entry, which registers all 33 types.
- Pele is never bundled into `dist`. No Pele type appears in the public `.d.ts`.
- mermaid.js is not a dependency, a fallback, or a benchmark input.

## Why we chose it

Pele's own claim, from [pele.run](https://pele.run), read on 2026-10-19: "Zero dependencies, 6× smaller, and up to 500× faster than Mermaid.js." We did not test that claim against mermaid.js.

Our own number is smaller in scope, and unverified. It comes from a local harness that is not in the repo. The four-line starter flowchart drew in 0.90 ms at p95, Pele plus the DOMPurify sanitize step. The run left out one warm-up draw and did not time the chunk load. It used headless Google Chrome 155 on an Apple M5 Max with `pele@1.6.0`, 50 samples, on 2026-10-18. It is a laptop number, not a phone number.

## Credit

Diagrams are drawn by [Pele](https://pele.run), the Mermaid renderer by Steph Ango ([@kepano](https://x.com/kepano)), CEO of Obsidian. MIT licence.

This package is not made by or affiliated with Obsidian. Pele bugs go to Pele upstream.
