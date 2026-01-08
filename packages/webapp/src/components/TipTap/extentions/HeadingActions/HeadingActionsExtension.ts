import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { createHoverChatPlugin } from './plugins/hoverChatPlugin'
import { createSelectionChatPlugin } from './plugins/selectionChatPlugin'
import { createHeadingTogglePlugin } from './plugins/headingTogglePlugin'
import type { HeadingActionsOptions } from './types'

/**
 * HeadingActions Extension
 *
 * A unified extension that combines heading-related action features:
 * - Hover chat: Chat button on heading hover
 * - Selection chat: Comment button on text selection
 * - Heading toggle: Fold/unfold heading sections
 *
 * @example
 * ```typescript
 * HeadingActionsExtension.configure({
 *   hoverChat: true,
 *   selectionChat: !isMobile,
 *   headingToggle: true
 * })
 * ```
 */
export const HeadingActionsExtension = Extension.create<HeadingActionsOptions>({
  name: 'headingActions',

  addOptions() {
    return {
      hoverChat: true,
      selectionChat: true,
      headingToggle: true
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

    if (this.options.headingToggle) {
      plugins.push(createHeadingTogglePlugin(editor))
    }

    return plugins
  }
})
