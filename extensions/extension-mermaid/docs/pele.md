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

Our own laptop number is small in scope. The four-line starter flowchart drew in 0.90 ms at p95, Pele plus the DOMPurify sanitize step. The run left out one warm-up draw and did not time the chunk load. It used headless Google Chrome 155 on an Apple M5 Max with `pele@1.6.0`, 50 samples, on 2026-10-18.

## Measured on real phones

The default `limits` come from a run on a real iPhone (Safari) and a real Android phone (Chrome) on 2026-10-21, with `pele@1.7.0`. A local harness, not in the repo, drew each test source 50 times after one warm-up. One sample is Pele plus the DOMPurify sanitize step. The rule: a level passes when every source at that size drew within **200 ms at p99**.

Worst p99 per level, in ms. "Characters" is the slowest of seven grown sources (sequence, class, state, er, gantt, gitGraph and mindmap). "Edges" is a flowchart with exactly that many arrows.

| Size (characters / edges) | Mac, characters / edges | iPhone, characters / edges | Android, characters / edges |
| ------------------------- | ----------------------- | -------------------------- | --------------------------- |
| 20000 / 1000              | 51.1 / 67.8             | 180.0 / 374.0              | 1945.7 / 1936.9             |
| 15000 / 750               | 37.1 / 55.5             | 132.0 / 328.0              | 1096.8 / 286.6              |
| 10000 / 500               | 25.2 / 37.2             | 94.0 / 229.0               | 176.2 / 202.4               |
| 5000 / 250                | 15.3 / 20.7             | 51.0 / 119.0               | 105.0 / 118.6               |

So the defaults are **10000 characters** (the Android phone failed at 15000) and **250 edges** (both phones failed at 500). The starter and the 59 examples from pele.run drew within 21.3 ms at p99 on every device.

An earlier estimate came from a laptop with a 6x CPU slowdown, and it gave 15000 and 500. The real Android phone was much slower than that estimate at the larger sizes. Use a real mid-range phone when you set your own `limits`.

## Credit

Diagrams are drawn by [Pele](https://pele.run), the Mermaid renderer by Steph Ango ([@kepano](https://x.com/kepano)), CEO of Obsidian. MIT licence.

This package is not made by or affiliated with Obsidian. Pele bugs go to Pele upstream.
