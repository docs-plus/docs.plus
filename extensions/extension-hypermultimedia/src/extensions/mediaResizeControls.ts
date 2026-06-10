import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import {
  handleMediaClick,
  handleMediaHover,
  handleMediaUnhover,
  hideMediaResizeControls,
  syncControlsToDoc
} from '../utils/media-resize-controls'
import { hasFinePointer } from '../utils/media-target'
import { shouldHideResizeGripper, transactionAffectsTrackedNodes } from './decorationHelpers'

export interface MediaResizeControlsOptions {
  /** Media node types whose add/remove should tear down hover chrome (includes X). */
  trackedNodes: string[]
}

export const MediaResizeControls = Extension.create<MediaResizeControlsOptions>({
  name: 'MediaResizeControls',

  addOptions() {
    return {
      trackedNodes: ['image']
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const { trackedNodes } = this.options

    return [
      new Plugin({
        key: new PluginKey('MediaResizeControls'),
        view: () => ({
          update: () => syncControlsToDoc(editor),
          destroy: () => hideMediaResizeControls(editor)
        }),
        appendTransaction(transactions) {
          const shouldHide = transactions.some(
            (tr) => shouldHideResizeGripper(tr) || transactionAffectsTrackedNodes(tr, trackedNodes)
          )
          if (shouldHide) hideMediaResizeControls(editor)
          return null
        },
        props: {
          handleDOMEvents: {
            mouseover: (view, event) =>
              view.editable ? handleMediaHover(editor, event, hasFinePointer()) : false,
            mouseout: (view, event) =>
              view.editable ? handleMediaUnhover(editor, event, hasFinePointer()) : false,
            // Touch taps synthesize `click`; finePointer gates hover vs click-to-lock downstream.
            click: (view, event) => (view.editable ? handleMediaClick(editor, event) : false)
          }
        }
      })
    ]
  }
})
