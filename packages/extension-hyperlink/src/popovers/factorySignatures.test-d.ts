// Type-only fence: pins the symmetric `(opts) => HTMLElement` contract
// for all three prebuilt popover factories. Checked by `tsc --noEmit`;
// drift to `void` or `HTMLElement | null` fails the build. Runtime DOM
// behaviour is covered by the Cypress preview / edit / create specs.
import createHyperlinkPopover from './createHyperlinkPopover'
import editHyperlinkPopover from './editHyperlinkPopover'
import previewHyperlinkPopover from './previewHyperlinkPopover'

type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

type AssertTrue<T extends true> = T

type _PreviewReturnsElement = AssertTrue<
  Equals<ReturnType<typeof previewHyperlinkPopover>, HTMLElement>
>
type _EditReturnsElement = AssertTrue<Equals<ReturnType<typeof editHyperlinkPopover>, HTMLElement>>
type _CreateReturnsElement = AssertTrue<
  Equals<ReturnType<typeof createHyperlinkPopover>, HTMLElement>
>

// `attrs` must be required on `PreviewHyperlinkOptions` — closing the
// hatch where `link.getAttribute('href')` could serve a stored
// `javascript:foo` href that escaped the validated mark attribute.
import type { PreviewHyperlinkOptions } from '../hyperlink'

const _validPreviewOpts: PreviewHyperlinkOptions = {
  editor: {} as never,
  link: {} as never,
  nodePos: 0,
  attrs: {
    href: 'https://example.com',
    target: null,
    rel: null,
    class: null,
    title: null,
    image: null
  }
}
void _validPreviewOpts

// @ts-expect-error: missing required `attrs`
const _invalidPreviewOpts: PreviewHyperlinkOptions = {
  editor: {} as never,
  link: {} as never,
  nodePos: 0
}
void _invalidPreviewOpts
