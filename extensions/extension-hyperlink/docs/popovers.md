# Popovers

Part of the [`@docs.plus/extension-hyperlink` README](../README.md).

Three slots cover the whole link lifecycle: preview on click, create on `Mod-k`, and edit from preview.

The README [Gallery](../README.md#gallery) shows the three prebuilt popovers.

Three ways to use them:

- **Use the prebuilt popovers** — slot the three factories into `Hyperlink.configure({ popovers })`, as in [Quickstart](../README.md#quickstart). The shell handles positioning, dismissal, focus, and cleanup.
- **Open them from outside the editor** — call [the openers](#openers) from a toolbar button or a React component.
- **Replace one or all of them** — pass your own factory into the matching slot. See [Bring your own popover](#bring-your-own-popover). For a popover that is not anchored to a hyperlink, or to observe popover state from outside, see [Advanced](./advanced.md).

## Visible action labels

The prebuilt preview makes no metadata request and needs no `/api/metadata` endpoint.
Its buttons use icons, accessible names, and hover/focus tooltips.
To show text beside every icon, wrap the existing factory:

```ts
Hyperlink.configure({
  popovers: {
    previewHyperlink: (options) => {
      const root = previewHyperlinkPopover(options)
      root.style.flexWrap = 'wrap'
      root.style.maxWidth = 'calc(100vw - 32px)'
      for (const button of root.querySelectorAll('button')) {
        const label = document.createElement('span')
        label.textContent = button.getAttribute('aria-label')
        button.append(label)
        button.style.width = 'auto'
        button.style.padding = '0 10px'
      }
      return root
    }
  }
})
```

This keeps the built-in actions and gives touch users visible labels without waiting for a tooltip.
For metadata cards, supply a custom preview factory and fetch metadata through your own service.

## Popover-factory option shapes

Every factory takes one `options` argument. The shape depends on the slot.

**`PreviewHyperlinkOptions`** — passed to `popovers.previewHyperlink` on every link click.

| Field           | Type                       | Description                                                                                                                                                             |
| --------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor`        | `Editor`                   | The Tiptap editor instance. Reach the `EditorView` through `editor.view` when you need it.                                                                              |
| `link`          | `HTMLAnchorElement`        | The clicked `<a>` node. It anchors the popover, so the popover follows the link on scroll.                                                                              |
| `nodePos`       | `number`                   | Document position of the link mark. Pair it with `editor.state.doc.nodeAt(nodePos)` to read the mark.                                                                   |
| `attrs`         | `HyperlinkAttributes`      | **Required.** The mark's stored attributes. Prefer `attrs.href` over `link.href` (the DOM property resolves against `document.baseURI` and would leak the host origin). |
| `validate?`     | `(url: string) => boolean` | The configured `validate` option, forwarded.                                                                                                                            |
| `isAllowedUri?` | `(uri: string) => boolean` | The composed gate. **Your popover must call this before any navigation, including a rendered `<a href>` and any `window.open`.**                                        |

Return `null` to opt out for this click, for example to open a mobile bottom sheet. The package then mounts no popover.

**`CreateHyperlinkOptions`** — passed to `popovers.createHyperlink` when `Mod-k` or `editor.commands.openCreateHyperlinkPopover()` fires.

| Field           | Type                           | Description                                                                                                    |
| --------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `editor`        | `Editor`                       | The Tiptap editor instance.                                                                                    |
| `extensionName` | `string`                       | The mark name, always `'hyperlink'`. Pass it straight to commands so your factory names the mark in one place. |
| `attributes`    | `Partial<HyperlinkAttributes>` | Pre-fill values forwarded from `openCreateHyperlinkPopover(attributes?)`. Empty when `Mod-k` fires.            |
| `validate?`     | `(url: string) => boolean`     | The configured `validate` option, forwarded.                                                                   |

Return `null` when the popover cannot open, for example when DOM construction fails. The command then returns `false`.

**`EditHyperlinkOptions`** — passed to `popovers.editHyperlink`, and to `openEditHyperlink(opts)` when you call it from outside a preview popover.

| Field           | Type                       | Description                                                                                                                                   |
| --------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor`        | `Editor`                   | The Tiptap editor instance.                                                                                                                   |
| `link`          | `HTMLAnchorElement`        | The link being edited. It anchors the popover.                                                                                                |
| `nodePos?`      | `number`                   | Document position of the link mark. It lets edit and Back recover the anchor when ProseMirror replaces duplicate link DOM nodes.              |
| `validate?`     | `(url: string) => boolean` | The configured `validate` option, forwarded — the edit form rejects the same URLs as `Mod-k`.                                                 |
| `isAllowedUri?` | `(uri: string) => boolean` | The composed gate, forwarded so Back re-opens the preview under the same navigation policy.                                                   |
| `onBack?`       | `() => void`               | Overrides the default Back behavior. By default, Back re-opens the preview popover through `openPreviewHyperlink`. Use it as an escape hatch. |
| `markName?`     | `string`                   | Mark name to extend the range over, always `'hyperlink'`. It exists so your factory passes one name through to `extendMarkRange`.             |

## Openers

The three named openers open a popover from outside the click handler. Call them from a keyboard shortcut, an outer toolbar button, a React modal, or a Tiptap command.

| Opener                                     | Anchor                    | Slot                        | Returns                                                  |
| ------------------------------------------ | ------------------------- | --------------------------- | -------------------------------------------------------- |
| `openPreviewHyperlink(opts)`               | `opts.link` (anchor node) | `popovers.previewHyperlink` | `boolean` — `false` when the factory returns `null`.     |
| `openEditHyperlink(opts)`                  | `opts.link` (anchor node) | `popovers.editHyperlink`    | `void` — the opt-out is not observable at the call site. |
| `openCreateHyperlink(editor, attributes?)` | Current selection         | `popovers.createHyperlink`  | `boolean` — `false` when the factory returns `null`.     |

Each opener reads its slot from `Hyperlink.configure({ popovers })`. Each opener falls back to the prebuilt factory when the slot is empty. It then builds the content and mounts through the controller. A factory that returns `null` opts out, which is the usual mobile path, and the opener then does nothing. Read the return value when your host routes to a bottom sheet.

`buildPreviewOptionsFromAnchor({ editor, link, nodePos?, validate?, isAllowedUri?, markName? })` rebuilds a full `PreviewHyperlinkOptions` from a live `<a>` node, with no hand-rolled `posAtDOM` → `mark.attrs` lookup. `openPreviewHyperlink(buildPreviewOptionsFromAnchor({ editor, link }))` is the canonical edit-to-preview handoff.

## Bring your own popover

Three minimal factories that match the option shapes above. A factory supplies content only. The shell keeps its per-popover ARIA semantics: `role="toolbar"` for preview, and `role="dialog"` named "Add link" or "Edit link" for create and edit. Your popovers therefore stay accessible with no extra wiring. The shell also owns dismissal and focus — see [Floating-popover primitive](./advanced.md#floating-popover-primitive). The create and edit examples call `validateURL(url, { customValidator: validate })` for the form-level shape check — see [`validate` vs `isAllowedUri`](./api.md#validate-vs-isalloweduri).

<details>
<summary><b>Custom <code>previewHyperlink</code></b></summary>

```ts
import {
  getDefaultController,
  Hyperlink,
  isSafeHref,
  type PreviewHyperlinkOptions
} from '@docs.plus/extension-hyperlink'

function previewHyperlink(options: PreviewHyperlinkOptions): HTMLElement {
  const { editor, attrs, isAllowedUri } = options
  const root = document.createElement('div')

  // A rendered `<a target="_blank">` navigates on click, so it is a navigation
  // sink like `window.open`. Gate it on the composed gate, and fall back to
  // `isSafeHref` when the factory runs outside the click handler.
  const isOpenable = isAllowedUri ?? isSafeHref
  // `attrs.href` is `string | null` and can predate the current policy.
  const raw = attrs.href ?? ''
  const href = isOpenable(raw) ? raw : ''

  const link = document.createElement('a')
  link.href = href
  link.textContent = attrs.href ?? ''
  link.target = '_blank'
  link.rel = 'noopener noreferrer'

  // `title` and `image` are mark-only metadata: the package stores them
  // and renders neither. Read them here to show a link card. `isSafeHref`
  // runs on `image`, and it rejects `data:`, so an inline favicon is dropped.
  if (attrs.title) link.textContent = attrs.title
  if (isSafeHref(attrs.image)) {
    const favicon = document.createElement('img')
    favicon.src = attrs.image
    favicon.width = 16
    favicon.height = 16
    root.append(favicon)
  }

  const remove = document.createElement('button')
  remove.textContent = 'Remove'
  remove.addEventListener('click', () => {
    getDefaultController().close()
    editor.chain().focus().unsetHyperlink().run()
  })

  root.append(link, remove)
  return root
}

const HyperlinkWithPreview = Hyperlink.configure({ popovers: { previewHyperlink } })
```

`configure` returns a new extension instance. Pass `HyperlinkWithPreview` into `new Editor({ extensions: [...] })`. Drop the value and a click on a link opens no popover.

</details>

<details>
<summary><b>Custom <code>createHyperlink</code></b></summary>

```ts
import {
  getDefaultController,
  Hyperlink,
  validateURL,
  type CreateHyperlinkOptions
} from '@docs.plus/extension-hyperlink'

function createHyperlink(options: CreateHyperlinkOptions): HTMLElement {
  const { editor, validate } = options
  const form = document.createElement('form')

  const input = document.createElement('input')
  input.type = 'url'
  input.placeholder = 'https://example.com'

  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.textContent = 'Apply'

  form.append(input, submit)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const url = input.value.trim()
    if (!validateURL(url, { customValidator: validate })) return

    // Delegate to the canonical command — it normalizes the protocol
    // and runs the composed gate. Returns `false` when the gate rejects,
    // so the popover stays open and the user can re-prompt.
    const chain = editor.chain().setHyperlink({ href: url })
    // `setHyperlink` writes a mark and never inserts text. With an empty
    // selection the mark reaches `storedMarks` only and nothing appears,
    // so give the link its own text. The prebuilt form does the same.
    if (editor.state.selection.empty) chain.insertContent({ type: 'text', text: url })
    if (chain.run()) getDefaultController().close()
  })

  return form
}

const HyperlinkWithCreateForm = Hyperlink.configure({ popovers: { createHyperlink } })
```

Pass `HyperlinkWithCreateForm` into `new Editor({ extensions: [...] })`. Drop the value and `Mod-k` opens the prebuilt form instead.

</details>

<details>
<summary><b>Custom <code>editHyperlink</code></b></summary>

```ts
import {
  buildPreviewOptionsFromAnchor,
  getDefaultController,
  Hyperlink,
  openPreviewHyperlink,
  validateURL,
  type EditHyperlinkOptions
} from '@docs.plus/extension-hyperlink'

function editHyperlink(options: EditHyperlinkOptions): HTMLElement {
  const { editor, link, validate, isAllowedUri, onBack, markName = 'hyperlink' } = options
  const form = document.createElement('form')

  // Pre-fill from the live link, reading the raw `href` attribute — the DOM
  // `link.href` property resolves relative hrefs against `document.baseURI`,
  // so an untouched Apply would rewrite them. The prebuilt form does the same.
  const textInput = document.createElement('input')
  textInput.type = 'text'
  textInput.value = link.innerText
  textInput.placeholder = 'Link text'

  const hrefInput = document.createElement('input')
  hrefInput.type = 'url'
  hrefInput.value = link.getAttribute('href') ?? ''
  hrefInput.placeholder = 'https://example.com'

  const back = document.createElement('button')
  back.type = 'button'
  back.textContent = 'Back'
  back.addEventListener('click', () => {
    // Back UX: honor `onBack` when the caller provided one (rare, escape
    // hatch); otherwise re-open the preview for the same link. Do not
    // close instead — that is a silent dismissal, not Back.
    if (onBack) return onBack()
    openPreviewHyperlink(
      buildPreviewOptionsFromAnchor({ editor, link, validate, isAllowedUri, markName })
    )
  })

  const apply = document.createElement('button')
  apply.type = 'submit'
  apply.textContent = 'Apply'

  form.append(textInput, hrefInput, back, apply)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const newText = textInput.value.trim()
    const newURL = hrefInput.value.trim()
    if (!newText || !validateURL(newURL, { customValidator: validate })) return

    // Extend across the full mark range so the edit applies to every
    // position the link covers, then delegate to the canonical command.
    // It returns `false` when the composed gate rejects — keep the
    // popover open in that case so the user can correct.
    const ok = editor
      .chain()
      .focus()
      .extendMarkRange(markName)
      .editHyperlink({ newURL, newText })
      .run()
    if (!ok) return

    getDefaultController().close()
  })

  queueMicrotask(() => textInput.focus())

  return form
}

const HyperlinkWithEditForm = Hyperlink.configure({ popovers: { editHyperlink } })
```

Pass `HyperlinkWithEditForm` into `new Editor({ extensions: [...] })`. Drop the value and the preview Edit button opens the prebuilt form instead.

</details>
