# Paste title

Part of the [`@docs.plus/extension-hyperlink` README](../README.md).

The `pasteTitle` option turns a pasted bare URL into a link named after its page. The link appears at once, with the URL as its text. Your `fetchTitle` returns the page title. The package then puts the title in place of the URL, as its own undo step.

The package makes no request of its own. Your `fetchTitle` decides where the title comes from. Unset means off.

## Quickstart

```ts
import { Hyperlink } from '@docs.plus/extension-hyperlink'

Hyperlink.configure({
  pasteTitle: {
    fetchTitle: async ({ href, signal }) => {
      const res = await fetch(`/metadata?url=${encodeURIComponent(href)}`, { signal })
      if (!res.ok) return null
      const data = await res.json()
      return typeof data.title === 'string' ? data.title : null
    }
  }
})
```

`/metadata` stands for your own server route. See [Wire a backend](#wire-a-backend).

Paste `https://example.com` into an empty line. The link shows the URL first. When `fetchTitle` answers "Example Domain", the link text becomes "Example Domain", and the href stays `https://example.com`. Press `Mod-z` once, and the URL comes back.

## When it runs

A paste gets a title only when all of these hold:

- It is a real paste from the clipboard. A drop and `insertContent` never start one.
- Nothing is selected. A URL pasted over a selection keeps the selected text, as before.
- The plain clipboard text, without the space around it, is one URL and nothing else. `see https://example.com` starts nothing. An email address or a phone number starts nothing.
- Shift is not held. `Mod-Shift-v` pastes the raw URL. See [User controls](#user-controls).
- The URL passes the same gates as the paste rule: `validate`, `isAllowedUri` and `shouldAutoLink`. That holds even when the link comes from HTML on the clipboard.
- The paste made a link whose text is that URL and whose href is the gated one. A code block and a media embed make no link, so they stop it too.
- `shouldFetch` returns `true`, when you set it.

Only the editor that pasted calls `fetchTitle` and makes the swap. Other people in a shared document get a normal edit.

## Options

| Field          | Type                                                  | Description                                                                                                                                  |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetchTitle`   | `(ctx: PasteTitleContext) => Promise<string \| null>` | **Required.** Returns the page title, or `null` to keep the URL. See [The resolver contract](#the-resolver-contract).                        |
| `shouldFetch?` | `(ctx: { href: string; editor: Editor }) => boolean`  | Runs before any request. Return `false` to skip this paste, for example when a user setting is off. A throw counts as `false` and logs once. |

`PasteTitleContext`:

| Field    | Type          | Description                                                                                                                                                                          |
| -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `href`   | `string`      | The href the paste rule stores for this URL, after normalizing and every URL gate. Never the raw clipboard text. `example.com` gives `https://example.com`.                          |
| `editor` | `Editor`      | The editor that holds the link. It helps when one page has two editors.                                                                                                              |
| `signal` | `AbortSignal` | Aborts whenever the job ends, after a good answer too: at the deadline, on a drop and on destroy. Pass it to your own `fetch`. Do not pass it to a request that other callers share. |

`PasteTitleOptions` and `PasteTitleContext` are root type exports.

## The resolver contract

`fetchTitle` answers in one of these ways:

| Answer                  | Result                                               |
| ----------------------- | ---------------------------------------------------- |
| A string                | The package cleans it, then swaps it in.             |
| `null`                  | The URL stays.                                       |
| A throw or a rejection  | The URL stays. Nothing is logged.                    |
| An abort (`AbortError`) | The URL stays. An abort is never an error.           |
| Any other value         | The URL stays, and the package logs once per editor. |
| No answer within 4 s    | The signal aborts, and the URL stays.                |

The package cleans every title before it swaps it in, so each host gets the same safety:

1. It trims the title and turns every run of white space into one space.
2. It removes the C0 and C1 control characters and the bidi controls U+202A to U+202E, U+2066 to U+2069, U+200E, U+200F and U+061C.
3. It cuts a title longer than 120 characters to 120 and adds `…`. It counts what a reader sees as one character, so an emoji is one.
4. It keeps the URL when the title then has no visible character, or when it equals the URL or the href. It also keeps the URL when the title reads as the address of another site. A link to `evil.example` titled `paypal.com` keeps its URL. One exception: a link's own file name passes when its extension is also a domain ending (`.zip`, `.mov`, `.md`, `.py`, `.rs`, `.sh`, `.ai`, `.ps`, `.pl`, `.so`). So `…/archive.zip` titled `archive.zip` swaps. The name must be one word, one dot and the extension, with no `/`, `\`, `?`, `#`, `@` or `:`. A decoded `paypal.com%2Flogin.zip` or `paypal.com.zip` keeps its URL.

The engine keeps no cache. Cache titles by URL in your own code, so a paste of a known page answers at once.

## The deadline and the drop rule

Each paste starts one job. The job waits up to 4 s for the answer. At 4 s the signal aborts, and a later answer changes nothing.

The job ends for good, and its signal aborts, when any of these happens first:

- The link text stops being the pasted URL. Typing inside the link, deleting it, an undo of the paste, or a peer's edit all count.
- The link's href changes.
- The answer comes while the caret or the selection edge sits inside the link. A swap then would move the caret.
- The editor is read-only or destroyed when the answer comes.
- Five jobs wait at once, and a sixth paste starts. The oldest job ends.

While an IME composition is active, the swap waits for `compositionend`. The 4 s deadline still applies.

The swap changes only the link text. The new text takes the marks of the link's first text node, so the href stays. The caret and the scroll position stay too. The package calls neither `focus()` nor `scrollIntoView()`.

## User controls

A reader has four ways to keep the URL:

1. **Leave the option unset.** You turn the feature on per editor. Unset means no request and no swap.
2. **Undo once.** `Mod-z` right after the swap restores the URL. A second `Mod-z` removes the paste.
3. **Paste raw.** `Mod-Shift-v` still makes a link, with the URL as its text, and calls nothing.
4. **A setting in your app.** Read it in `shouldFetch` at call time:

```ts
Hyperlink.configure({
  pasteTitle: {
    fetchTitle: loadTitle,
    shouldFetch: () => settings.pasteTitles
  }
})
```

`loadTitle` and `settings` stand for your own code.

Undo works the same way with `prosemirror-history` (StarterKit's undo) and with Tiptap's collaboration undo. Each `Mod-z` goes one step back:

1. Any typing after the swap goes.
2. The title goes, and the URL comes back.
3. The paste goes.

## Wire a backend

`fetchTitle` usually calls your own server. The server fetches the page and reads its `<title>` or `og:title`. A server that fetches any URL a user gives it needs these guards:

- **Block private addresses (SSRF).** Resolve the host first. Refuse loopback, private, link-local and cloud metadata addresses, such as `127.0.0.0/8`, `10.0.0.0/8` and `169.254.169.254`. Check again after each redirect.
- **Limit the fetch.** Allow only `http:` and `https:`. Cap the redirects, the time and the bytes you read. A title sits in the first kilobytes of a page.
- **Rate-limit the route.** One paste is one request, and a script can paste many times.
- **Return only the text.** The package cleans the title again, but your server should not pass back markup.

A browser-only `fetchTitle` that reads the page itself cannot work for most sites. Cross-origin pages block the read.

**Privacy.** Each paste sends the pasted URL to your server, and your server then visits that page. Say so in your privacy notice, as you would for link previews. Give readers a way to turn it off through `shouldFetch`.

If you also use the [hovercard](./hovercard.md), one route can serve both. Dedupe by URL, so a paste and the hover that follows share one request. Do not pass `signal` to a request that other callers share, because it aborts when the job ends.

## Collaboration

The job tracks the link with `editor.utils.createMappablePosition` and `getUpdatedPosition`. Tiptap's collaboration extension swaps these for Yjs relative positions, so a peer's edit near the link never shifts it. The package imports no `yjs` and no `@tiptap/y-tiptap`.

The swap is one transaction. It goes through `closeHistory(tr)` from `@tiptap/pm/history`, which starts a new `prosemirror-history` step. So one undo restores the URL. It also carries these meta keys:

| Meta key          | Why                                                                      |
| ----------------- | ------------------------------------------------------------------------ |
| `inputRule`       | Starts a new step in Tiptap's collaboration undo, as an input rule does. |
| `preventAutolink` | Keeps autolink off the new text.                                         |
| `pasteTitle`      | `true`. Lets your app tell the swap apart from an edit.                  |

An empty transaction follows the swap. It also goes through `closeHistory(tr)` and carries `inputRule`. It closes the undo step, so typing after the swap is a step of its own. The swap never sets `addToHistory: false`: under Yjs that would make the paste impossible to undo.

```ts
editor.on('transaction', ({ transaction }) => {
  if (transaction.getMeta('pasteTitle')) {
    // the package swapped a pasted URL for its title
  }
})
```

## Testing

To test your own wiring, fake the clock. Then the 4 s deadline and the undo steps do not depend on real time.

## Caveats

- **The title hides the address in the text.** The href stays the real one, so a click, the preview and the hovercard still show where the link goes. The cleaner refuses a title that reads as another site's address.
- **Only the keyboard marks a raw paste.** ProseMirror reads Shift from the key events. "Paste and Match Style" from a browser menu sends no key, so that paste still gets a title.
- **A URL pasted with HTML can still get a title.** When the clipboard also holds HTML, the package checks the plain text, the gated href and the link the paste made. A link whose text or href differs starts nothing.
- **A URL pasted twice with no space gets no title.** Paste the same URL twice with no space between, and the two runs join into one link whose text is not the URL. Neither job swaps.
