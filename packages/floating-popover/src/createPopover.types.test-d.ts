// packages/extension-hyperlink/src/floating-popover/createPopover.types.test-d.ts
//
// Type-only fence: `PopoverOptions` is a discriminated union, so
// omitting both `referenceElement` and `coordinates` must be a compile
// error. This file is checked by `tsc --noEmit`; the @ts-expect-error
// fails the build if the rejection ever stops working.
import { createPopover, type PopoverOptions } from './createPopover'

const el = document.createElement('div')

// Valid: referenceElement variant
createPopover({ referenceElement: el, content: el })

// Valid: coordinates variant
createPopover({
  coordinates: {
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 })
  },
  content: el
})

// Invalid: neither anchor — must be a compile error.
// @ts-expect-error: missing referenceElement | coordinates
createPopover({ content: el })

// Type-level assertion: PopoverOptions is the union of two anchor variants.
type Anchor = Pick<PopoverOptions, 'referenceElement' | 'coordinates'>
const _refOnly: Anchor = { referenceElement: el }
const _coordsOnly: Anchor = {
  coordinates: { getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }) }
}
void _refOnly
void _coordsOnly
