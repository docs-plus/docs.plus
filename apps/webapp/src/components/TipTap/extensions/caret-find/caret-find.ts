import { Extension } from '@tiptap/core'

import {
  caretFindPluginKey,
  closeFindTr,
  createCaretFindPlugin,
  openFindTr,
  setFindQueryTr,
  stepFindTr
} from './caret-find-plugin'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    caretFind: {
      openCaretFind: () => ReturnType
      closeCaretFind: () => ReturnType
      setCaretFindQuery: (query: string) => ReturnType
      stepCaretFind: (direction: 1 | -1) => ReturnType
    }
  }
}

/** Pad text find: decorations only, so hits never enter the doc or its history. */
export const CaretFind = Extension.create({
  name: 'caretFind',
  // Last in line, so an editor key handler that takes Escape (the slash menu) keeps it.
  priority: 1,

  addCommands() {
    return {
      openCaretFind:
        () =>
        ({ state, tr, dispatch }) => {
          if (dispatch) openFindTr(state, tr)
          return true
        },

      closeCaretFind:
        () =>
        ({ state, tr, dispatch }) => {
          if (dispatch) closeFindTr(state, tr)
          return true
        },

      setCaretFindQuery:
        (query: string) =>
        ({ state, tr, dispatch }) => {
          if (dispatch) setFindQueryTr(state, tr, query)
          return true
        },

      stepCaretFind:
        (direction: 1 | -1) =>
        ({ state, tr, dispatch }) =>
          dispatch ? stepFindTr(state, tr, direction) : true
    }
  },

  addKeyboardShortcuts() {
    return {
      Escape: () =>
        !!caretFindPluginKey.getState(this.editor.state)?.open &&
        this.editor.commands.closeCaretFind()
    }
  },

  addProseMirrorPlugins() {
    return [createCaretFindPlugin()]
  }
})
