# URL handling

Part of the [`@docs.plus/extension-hyperlink` README](../README.md).

Every write boundary canonicalizes the href before storing it:

- **Bare domains** get `https://` in front: `google.com` → `https://google.com`.
- **Explicit schemes** pass through as typed: `http://`, `ftp://`, `whatsapp://`, `mailto:`.
- **Protocol-relative URLs** stay as they are: `//example.com`.
- **Bare E.164 phones** become `tel:`, and bare emails become `mailto:`.

For any URL linkifyjs detects, the create form, the [markdown input rule](#markdown), autolink, and paste all produce the same `href`. Paste detection is linkifyjs-only. A catalog app scheme such as `whatsapp://…` therefore autolinks as you type, but stays plain text when pasted. Register the scheme through `protocols` and paste detects it too.

Validation rejects a scheme-prefixed typo with no real host: `https://googlecom` fails. `http://localhost`, `https://127.0.0.1`, and any registered custom scheme pass.

`normalizeHref(raw, defaultProtocol?)` returns the canonical href the editor would store. Call it in your own popover to mirror the same canonicalization.

## Scheme classification

`getSpecialUrlInfo(href)` classifies a URL against the built-in catalog and returns `{ type, title, category } | null`. The catalog holds 47 schemes and 16 domains, matched on two different paths. A scheme matches by prefix, so `zoommtg:`, `vscode:`, and `spotify:` hit on the first characters. A domain matches by host suffix after `www.` is stripped, so `github.com` also covers `api.github.com`.

The package ships **no** icon catalog. `type` is a string-literal `SpecialUrlType` that you map to your own renderer:

```ts
import { getSpecialUrlInfo, type SpecialUrlType } from '@docs.plus/extension-hyperlink'
import * as Icons from './icons'

const TYPE_TO_ICON: Partial<Record<SpecialUrlType, () => string>> = {
  email: Icons.Mail,
  whatsapp: Icons.Chat
  // …one entry per `type` you want a fallback icon for
}

const info = getSpecialUrlInfo(href)
if (info) renderIcon(TYPE_TO_ICON[info.type])
```

`Partial<Record<SpecialUrlType, …>>` gives autocomplete and typo-protection without forcing exhaustiveness. Leave out domain-only types such as `meet` or web `github`, because the favicon path wins for a plain `https://` URL.

## Markdown

The mark ships its own markdown wiring: `markdownTokenName: 'link'` plus `parseMarkdown` and `renderMarkdown` hooks. `[label](https://example.com)` therefore round-trips when the host editor also loads a Markdown extension, such as `@tiptap/markdown`. The hooks stay inert otherwise, so they need no setup and run no code until a Markdown extension calls them.

Both directions are write boundaries. An imported href runs through `normalizeHref` and `isSafeHref`, so a markdown `javascript:` link lands with an empty `href`. On export, an unsafe href blanks the same way. `renderMarkdown` also percent-encodes `)` and whitespace, because the marked.js href grammar stops at both.

Typing `[text](url)` in the editor fires an input rule that writes the mark directly. That rule is always registered and carries no option — see [Caveats](./api.md#caveats).
