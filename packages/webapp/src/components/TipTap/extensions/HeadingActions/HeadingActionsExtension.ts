import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

import { createHoverChatPlugin } from './plugins/hoverChatPlugin'
import { createSelectionChatPlugin } from './plugins/selectionChatPlugin'
import type { HeadingActionsOptions } from './types'

export const HeadingActionsExtension = Extension.create<HeadingActionsOptions>({
  name: 'headingActions',

  addOptions() {
    return {
      hoverChat: true,
      selectionChat: true
    }
  },

  addProseMirrorPlugins() {
    const plugins: Plugin[] = []
    const { editor } = this

    if (this.options.hoverChat) {
      plugins.push(createHoverChatPlugin(editor))
    }

    if (this.options.selectionChat) {
      plugins.push(createSelectionChatPlugin(editor))
    }

    return plugins
  }
})
