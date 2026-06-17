import { Extension } from '@tiptap/core'
import type { EditorState, Transaction } from '@tiptap/pm/state'

import { createHeadingFilterPlugin, headingFilterPluginKey } from './heading-filter-plugin'

export interface HeadingFilterFoldAdapter {
  getFoldedIds: (state: EditorState) => Set<string>
  setTemporaryFolds: (tr: Transaction, ids: Set<string>) => Transaction
  restoreFolds: (tr: Transaction, savedIds: Set<string>) => Transaction
}

export interface HeadingFilterOptions {
  foldAdapter?: HeadingFilterFoldAdapter
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headingFilter: {
      clearFilter: () => ReturnType
      applyFilter: (slugs: string[], mode: 'or' | 'and') => ReturnType
    }
  }
}

export const HeadingFilter = Extension.create<HeadingFilterOptions>({
  name: 'headingFilter',

  addOptions() {
    return {
      foldAdapter: undefined
    }
  },

  addCommands() {
    return {
      clearFilter:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(headingFilterPluginKey, { type: 'clear' } as const)
          }
          return true
        },

      applyFilter:
        (slugs: string[], mode: 'or' | 'and') =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(headingFilterPluginKey, { type: 'apply', slugs, mode } as const)
          }
          return true
        }
    }
  },

  addProseMirrorPlugins() {
    return [createHeadingFilterPlugin({ foldAdapter: this.options.foldAdapter })]
  }
})
