import { Extension } from '@tiptap/core'
import type { EditorState, Transaction } from '@tiptap/pm/state'

import {
  createHeadingFilterPlugin,
  type HeadingFilterCallbackState,
  headingFilterPluginKey
} from './heading-filter-plugin'

export interface HeadingFilterFoldAdapter {
  getFoldedIds: (state: EditorState) => Set<string>
  setTemporaryFolds: (tr: Transaction, ids: Set<string>) => Transaction
  restoreFolds: (tr: Transaction, savedIds: Set<string>) => Transaction
}

export interface HeadingFilterOptions {
  onFilterChange?: (state: HeadingFilterCallbackState) => void
  foldAdapter?: HeadingFilterFoldAdapter
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headingFilter: {
      filterPreview: (query: string) => ReturnType
      commitFilter: (slug: string) => ReturnType
      removeFilter: (slug: string) => ReturnType
      clearFilter: () => ReturnType
      setFilterMode: (mode: 'or' | 'and') => ReturnType
      applyFilter: (slugs: string[], mode: 'or' | 'and') => ReturnType
    }
  }
}

export const HeadingFilter = Extension.create<HeadingFilterOptions>({
  name: 'headingFilter',

  addOptions() {
    return {
      onFilterChange: undefined,
      foldAdapter: undefined
    }
  },

  addCommands() {
    return {
      filterPreview:
        (query: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(headingFilterPluginKey, { type: 'preview', query } as const)
          }
          return true
        },

      commitFilter:
        (slug: string) =>
        ({ tr, dispatch }) => {
          const trimmed = slug.trim()
          if (!trimmed) return false
          if (dispatch) {
            tr.setMeta(headingFilterPluginKey, { type: 'commit', slug: trimmed } as const)
          }
          return true
        },

      removeFilter:
        (slug: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(headingFilterPluginKey, { type: 'remove', slug } as const)
          }
          return true
        },

      clearFilter:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(headingFilterPluginKey, { type: 'clear' } as const)
          }
          return true
        },

      setFilterMode:
        (mode: 'or' | 'and') =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(headingFilterPluginKey, { type: 'setMode', mode } as const)
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
    return [
      createHeadingFilterPlugin({
        onFilterChange: this.options.onFilterChange,
        foldAdapter: this.options.foldAdapter
      })
    ]
  }
})
