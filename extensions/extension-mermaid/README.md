# @docs.plus/extension-mermaid

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-mermaid.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-mermaid)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-mermaid.svg)](https://npmcharts.com/compare/@docs.plus/extension-mermaid)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-mermaid.svg)](https://www.npmjs.com/package/@docs.plus/extension-mermaid)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/25JPG38J59)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/demo-dark.gif">
    <img alt="A Mermaid radar chart in the editor. Changing one score reshapes a curve, a new curve line adds a third shape, and Hide source leaves only the chart" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/demo-light.gif">
  </picture>
</p>

Tiptap extension that draws Mermaid code blocks as live SVG diagrams. The source stays on top, and the diagram redraws under it as you type.

Diagrams are drawn by [Pele](https://pele.run), the Mermaid renderer by Steph Ango ([@kepano](https://x.com/kepano)), CEO of Obsidian. MIT licence.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/docs-plus/docs.plus/tree/main/extensions/extension-mermaid/examples/vanilla?file=main.ts)

## Why use it

- **The diagram follows the text.** The SVG redraws 300 ms after you stop typing, for local and remote edits. A mistake names its line and column, and the last good diagram stays in view.
- **Charts, not only flowcharts.** Pele detects 33 diagram types, such as sequence, Gantt, pie, radar, sankey, XY chart and mind map. See the [Gallery](#gallery).
- **Drawn by Pele, loaded on demand.** One chunk loads per diagram type. mermaid.js is not a dependency. Pele's speed claims and our own timing, with their limits, are in [About Pele](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/pele.md).
- **Readers see the diagram, writers see both.** Hide source folds the text away. Read-only editors start folded. Syntax and Copy sit in the same head.
- **No new node, and a plain fence in storage.** A diagram is a standard `codeBlock` with `language: 'mermaid'`. The document holds a `mermaid` fence, as on GitHub, GitLab and Obsidian, and never the SVG. Removing the extension leaves plain code blocks. Yjs merges the source per character.
- **Light and dark from your page.** The default colours follow `color-scheme`. Pele's `--pele-*` variables, or the `theme` option, set your own.
- **Safe defaults, with one gap.** Pele escapes diagram text. Links and remote images are off, and size limits cap the work. The SVG is not sanitized unless you pass `sanitize`, so pass it for sources you do not trust.

## Install

```sh
npm install @docs.plus/extension-mermaid
```

Or use `pnpm add @docs.plus/extension-mermaid`, `yarn add @docs.plus/extension-mermaid`, or `bun add @docs.plus/extension-mermaid`.

Requires **`@tiptap/core` ^3.31.3** and **`@tiptap/pm` ^3.31.3** (Tiptap 3.x).

This package imports no React, Vue, or Next.js code. Use it from a plain page, Vite, React, Vue, Svelte, Next.js, Nuxt, or SvelteKit. Create the editor in the browser.

React Native has no DOM. Load the editor in a web view.

Installs one runtime dependency: [`pele`](https://www.npmjs.com/package/pele) (`1.6.0`, pinned exactly), the renderer. The package loads it on demand and never bundles it.

Import the stylesheet `@docs.plus/extension-mermaid/styles.css`. The fold control, the head and the actions need it.

## Quickstart

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/docs-plus/docs.plus/tree/main/extensions/extension-mermaid/examples/vanilla?file=main.ts)

Run this Quickstart in your browser first, with nothing to install. The app lives in [`examples/vanilla`](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-mermaid/examples/vanilla).

The snippet also imports `@tiptap/starter-kit`. Add it with `npm install @tiptap/starter-kit` when your app has none yet.

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Mermaid } from '@docs.plus/extension-mermaid'
import '@docs.plus/extension-mermaid/styles.css'

// The page needs <div id="editor"></div> and `color-scheme: light dark`.
const editor = new Editor({ extensions: [StarterKit, Mermaid] })
editor.mount(document.querySelector('#editor')!)
editor.commands.setContent(
  '<pre><code class="language-mermaid">flowchart LR\n  A[Write] --> B[See it]</code></pre>'
)
```

You should see the source with a two-box flowchart under it. Edit the source, and the diagram redraws after you stop typing.

## Caveats

- **Only the exact language `mermaid` draws.** A fence tagged `Mermaid` with a capital M stays plain code in Markdown. An HTML round trip keeps only the first word, so ` ```mermaid title ` becomes a diagram there.
- **The editor needs a `codeBlock` node.** Without one, nothing draws and `insertMermaid` returns false.
- **Another `codeBlock` node view wins.** A host `addNodeView`, or an earlier plugin's `nodeViews.codeBlock`, replaces this one silently. A later plugin's `nodeViews.codeBlock` never runs.
- **Without `styles.css`, the fold control, the head and the actions render unstyled, and Pele's own error box shows.** Add the stylesheet. Or set `fold: false`, `helpLink: false` and `copy: false`, and copy the three rules from [Without `styles.css`](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/guide.md#without-stylescss).
- **The default colours need `color-scheme`.** They use `light-dark()`. Set `color-scheme: light dark` on your page, or the light colours always show.
- **Pele has no time limit.** Keep `limits` on. `edges` counts flowchart and agentflow only. See [Security](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/security.md).
- **The SVG is not sanitized by default.** Pass `sanitize` when sources come from people you do not trust. See [Sanitizing the SVG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/security.md#sanitizing-the-svg).

The full list, with the reason for each, is in [Caveats](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/api.md#caveats).

## Common tasks

### Add a toolbar or slash item

```ts
editor.chain().focus().insertMermaid().run()
```

The command inserts a four-line example and puts the caret at the end of the source. Gate the button with `editor.can().insertMermaid()`. Read the active state with `editor.isActive('codeBlock', { language: 'mermaid' })`. See [Commands](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/api.md#commands).

### Sanitize the SVG

```ts
import DOMPurify from 'dompurify'

Mermaid.configure({
  sanitize: (svg) =>
    DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true },
      ADD_ATTR: ['role'],
      FORBID_TAGS: ['style', 'a', 'image', 'use'],
      FORBID_ATTR: ['href', 'xlink:href'],
      RETURN_DOM_FRAGMENT: true
    })
})
```

The package does not depend on DOMPurify. The attributes that must survive are listed in [Security](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/security.md#sanitizing-the-svg).

### Report slow renders and load errors

```ts
Mermaid.configure({
  onStateChange({ state, error, durationMs }) {
    if (state === 'load-error') console.warn('Mermaid renderer did not load', error?.message)
    if (durationMs !== null && durationMs > 200) console.warn('Slow diagram', durationMs)
  }
})
```

`durationMs` covers Pele plus the sanitizer. It is null for every state except `ready` and `error`. See [onStateChange](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/api.md#onstatechange).

## Gallery

Each block is a plain `mermaid` fence, drawn with the default colours. Each screenshot has a light and a dark version, and follows your system preference.

<details>
<summary><strong>Flowchart</strong> — source on top, diagram under it</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/preview-dark.png">
    <img alt="A Mermaid code block with its source on top and the drawn flowchart under it" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/preview-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>XY chart</strong> — bars and a line on shared axes</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/xychart-dark.png">
    <img alt="An XY chart of weekly signups with a bar and a line for each day, source hidden" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/xychart-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>Sankey</strong> — flows between stages</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/sankey-dark.png">
    <img alt="A sankey diagram from visitors to sign-ups, writing and sharing, source hidden" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/sankey-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>Mind map</strong> — an outline as branches</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/mindmap-dark.png">
    <img alt="A mind map with docs.plus at the root and Write, Talk and Share branches, source hidden" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/mindmap-light.png">
  </picture>
</p>

</details>

<details>
<summary><strong>Sequence</strong> — messages between participants</summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/sequence-dark.png">
    <img alt="A sequence diagram where You, Editor and Pele pass a source and an SVG, source hidden" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-mermaid/assets/sequence-light.png">
  </picture>
</p>

</details>

## Documentation

| Guide                                                                                                      | What it covers                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [API reference](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/api.md) | Options, commands, states, `onStateChange`, fixed behaviour, class names, TypeScript exports, and the full caveats list |
| [Guide](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/guide.md)       | Theming, source folding, the view slot, accessible names, and syntax highlighting                                       |
| [Security](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/security.md) | Untrusted sources, limits, sanitizing the SVG, and CSP                                                                  |
| [About Pele](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/pele.md)   | What Pele is, how this package uses it, and the credit                                                                  |
| [Changelog](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/CHANGELOG.md)    | Every release and its breaking changes                                                                                  |
| [For AI coding agents](https://cdn.jsdelivr.net/npm/@docs.plus/extension-mermaid/README.md)                | This README as plain Markdown for your agent. The docs are also on [Context7](https://context7.com/docs-plus/docs.plus) |

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions and recommended pairings: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
