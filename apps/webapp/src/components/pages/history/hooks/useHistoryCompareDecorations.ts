import { getCachedProsemirrorFromHistoryYdoc } from '@components/pages/history/historyDecodeCache'
import { buildCompareDecorations } from '@components/pages/history/utils/compareDecorations'
import * as toast from '@components/toast'
import { useStore } from '@stores'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'
import { useEffect } from 'react'

const historyComparePluginKey = new PluginKey<DecorationSet>('historyCompare')

/**
 * Paints the compare diff on the read-only history editor. Mounted once per
 * history shell (DesktopHistory and MobileHistory).
 * The set lives in plugin state and moves by transaction metadata. Toggling compare therefore
 * never reconfigures the editor. A reconfigure rebuilds node views and reloads embeds.
 */
export const useHistoryCompareDecorations = () => {
  const editor = useStore((state) => state.editor)
  const compareMode = useStore((state) => state.compareMode)
  const compareBaseItem = useStore((state) => state.compareBaseItem)
  const activeHistory = useStore((state) => state.activeHistory)

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const plugin = new Plugin<DecorationSet>({
      key: historyComparePluginKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, value) {
          // A version switch replaces the whole document, and DecorationSet.create does
          // not range-check — a surviving set would paint the wrong spans of the new one.
          if (tr.docChanged) return DecorationSet.empty
          const next = tr.getMeta(historyComparePluginKey)
          return next === undefined ? value : (next as DecorationSet)
        }
      },
      props: {
        decorations: (state) => historyComparePluginKey.getState(state) ?? DecorationSet.empty
      }
    })

    editor.registerPlugin(plugin)
    return () => {
      if (editor.isDestroyed) return
      editor.unregisterPlugin(historyComparePluginKey)
    }
  }, [editor])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    // `DecorationSet.empty` is a singleton, so this also skips the no-op clear on mount
    // and on every render where compare is off.
    const commit = (next: DecorationSet) => {
      if (historyComparePluginKey.getState(editor.state) === next) return
      editor.view.dispatch(editor.state.tr.setMeta(historyComparePluginKey, next))
    }

    if (!compareMode || !compareBaseItem || !activeHistory) {
      commit(DecorationSet.empty)
      return
    }

    // Read the live doc first. TrailingNode appends an empty paragraph the decoded
    // version JSON does not carry, and any size drift shifts every later decoration.
    const capturedDoc = editor.state.doc
    const jsonA = getCachedProsemirrorFromHistoryYdoc(compareBaseItem.version, compareBaseItem.data)
    if (jsonA == null) {
      commit(DecorationSet.empty)
      return
    }

    const result = buildCompareDecorations(editor.schema, jsonA, capturedDoc.toJSON())
    if ('error' in result) {
      commit(DecorationSet.empty)
      toast.Error("Can't compare this version")
      return
    }

    // `DecorationSet.create` NULLS entries in the array it is given (prosemirror-view
    // `takeSpansForNode`), and only strips nulls on the call that made them.
    // `DecorationSet.create` must never see the same array twice, so
    // `buildCompareDecorations` returns a fresh one.
    commit(DecorationSet.create(capturedDoc, result.decorations))
  }, [editor, compareMode, compareBaseItem, activeHistory])
}
