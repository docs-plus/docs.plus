import { Extension } from '@tiptap/core'

import {
  createHeadingFoldPlugin,
  findSectionDom,
  headingFoldPluginKey,
  measureContentHeight
} from './heading-fold-plugin'
import { loadFoldedIds } from './helpers/fold-storage'

export interface HeadingFoldOptions {
  documentId: string
  onFoldChange?: (foldedIds: Set<string>) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headingFold: {
      toggleFold: (headingId: string) => ReturnType
    }
  }
}

export const HeadingFold = Extension.create<HeadingFoldOptions>({
  name: 'headingFold',

  addOptions() {
    return {
      documentId: 'default',
      onFoldChange: undefined
    }
  },

  addCommands() {
    return {
      toggleFold:
        (headingId: string) =>
        ({ tr, dispatch, view }) => {
          if (!dispatch) return true

          const state = headingFoldPluginKey.getState(view.state)
          if (state?.animating.has(headingId)) return true

          const isFolded = state?.foldedIds.has(headingId) ?? false

          if (!isFolded) {
            const { headingEl, contentNodes, nextSiblingEl } = findSectionDom(view, headingId)
            if (!headingEl) return false
            const contentHeight = measureContentHeight(headingEl, contentNodes, nextSiblingEl)
            tr.setMeta(headingFoldPluginKey, {
              type: 'toggle',
              id: headingId,
              contentHeight
            })
          } else {
            tr.setMeta(headingFoldPluginKey, {
              type: 'toggle',
              id: headingId
            })
          }

          dispatch(tr)
          return true
        }
    }
  },

  addProseMirrorPlugins() {
    const initialFoldedIds = loadFoldedIds(this.options.documentId)
    return [
      createHeadingFoldPlugin({
        documentId: this.options.documentId,
        initialFoldedIds,
        onFoldChange: this.options.onFoldChange
      })
    ]
  }
})
