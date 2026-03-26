import { Extension } from '@tiptap/core'

import { createHeadingDragPlugin } from './heading-drag-plugin'

export const HeadingDrag = Extension.create({
  name: 'headingDrag',

  addProseMirrorPlugins() {
    return [createHeadingDragPlugin()]
  }
})
