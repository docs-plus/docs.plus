// Type-only fence: omitting both `referenceElement` and `coordinates` must
// be a compile error. `tsc --noEmit` fails if the @ts-expect-error goes stale.
import { createPopover, type PopoverOptions } from './createPopover'

const el = document.createElement('div')

createPopover({ referenceElement: el, content: el })

createPopover({
  coordinates: {
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 })
  },
  content: el
})

// @ts-expect-error: missing referenceElement | coordinates
createPopover({ content: el })

type Anchor = Pick<PopoverOptions, 'referenceElement' | 'coordinates'>
const _refOnly: Anchor = { referenceElement: el }
const _coordsOnly: Anchor = {
  coordinates: { getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }) }
}
void _refOnly
void _coordsOnly
