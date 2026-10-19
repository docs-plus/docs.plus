# Security

Part of the [`@docs.plus/extension-mermaid` README](../README.md).

This page states only what the code does. Facts about Pele are read from `pele@1.6.0` in `node_modules`, not run, unless the text says otherwise. Pele's own guidance is at [pele.run/security](https://pele.run/security).

## Treat every source as untrusted

Anyone who can edit a shared document can write a diagram source. Every viewer draws it. The source also reaches the page through Pele's SVG string, so a bug in Pele's escaping is a bug in your page.

Pele escapes diagram text, filters links and styles, and limits source and output size. This package keeps Pele's options on their safe side:

| Setting       | Default                     | Effect                                                          |
| ------------- | --------------------------- | --------------------------------------------------------------- |
| `links`       | `false`, not an option      | Pele writes no `href` from the source.                          |
| `images`      | `false`                     | Remote images are off. `true` makes every viewer fetch the URL. |
| `outputLimit` | 1000000, not an option      | Pele refuses an SVG longer than this many characters.           |
| `limits`      | 15000 characters, 500 edges | Provisional. A longer or denser source shows a `limit` error.   |
| `sanitize`    | `null`                      | Pele's SVG is used as it is. See below.                         |

## Sanitizing the SVG

Pass `sanitize` when sources come from people you do not trust, or when your CSP is strict. Pele calls it with the SVG string. It must return a DOM `Node`. This config works with DOMPurify:

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

The two `FORBID_` lists drop links, images, `<use>` and `<style>`, so a source cannot load outside URLs or restyle the page.

The sanitizer must keep these, or the diagram loses its look or its accessible names:

- Attributes: `id`, `style`, `class`, `role`, `aria-roledescription`, `aria-labelledby` and `aria-describedby`.
- Elements: `<title>` and `<desc>`.

Our probe ran the config above, without the two `FORBID_` lists, on 61 sources: the starter, 58 example blocks, an `info` diagram and one with `accTitle` and `accDescr`. For each source, the count of the names above matched before and after sanitizing, and the root text matched. The probe did not count other elements or attributes. It used DOMPurify 3.4.15 with `pele@1.6.0`. A second probe ran the full config on seven sources: flowchart, sequence, pie, gantt, mindmap, class and state. The same counts matched.

## Time and size limits

Pele has no time limit. A draw runs synchronously on the main thread until it ends.

- `limits.characters` becomes Pele's `limit`. A longer source gives a `limit` error and is never drawn.
- `limits.edges` becomes Pele's `maxEdges`. Pele counts edges in flowchart and agentflow only, so other types have no edge cap.
- The crash marker covers the synchronous draw only. It sets a `sessionStorage` key before the draw and removes it after. If the tab freezes inside the draw, the key stays, and the next load of that source in the tab shows `skipped`.
- The marker does not cover Pele's own ResizeObserver and font redraws. They run outside it.

Keep `limits` on. Lower them for hosts that serve phones.

## Frontmatter and `%%{init}%%`

This section is **provisional**. It is read from the Pele source and has not been checked in a browser.

A source can carry frontmatter or an init directive. Pele merges that config into the per-diagram `config` object. The flowchart parser reads keys such as `flowchart.inheritDir` and `direction` from it, and the renderer reads `useMaxWidth`. So frontmatter can change layout.

The source cannot change `links`, `images`, `limit`, `maxEdges` or `outputLimit`. Pele takes `limit` and `maxEdges` from the mount options when it parses, and reads `links` and `images` from the render options. The merged `config` is a separate argument.

## Content Security Policy

- **Theme.** The `theme` option writes variables through the CSSOM (`style.setProperty`). A CSP does not block that.
- **Styles.** Pele's SVG carries inline `style` attributes. Your `style-src`, or `style-src-attr`, must allow inline styles for the diagram to look right. A sanitizer does not change this.
- **Scripts.** The package loads Pele with a dynamic `import()` of `pele/lazy`, plus one chunk per diagram type. Your bundler emits those chunks, so `script-src` must allow the origin that serves them.

## Reporting

Report a flaw in this package through the repository [security policy](../../../SECURITY.md). Bugs in Pele itself go to Pele upstream, and the docs.plus maintainer files them.
