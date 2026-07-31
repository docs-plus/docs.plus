import { getCachedProsemirrorFromHistoryYdoc } from '@components/pages/history/historyDecodeCache'
import { buildCompareDecorations } from '@components/pages/history/utils/compareDecorations'
import * as toast from '@components/toast'
import { useStore } from '@stores'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'
import { useEffect } from 'react'

const historyComparePluginKey = new PluginKey('historyCompare')

/** Paints the compare diff on the read-only history editor. Mounted once, by DesktopHistory. */
export const useHistoryCompareDecorations = () => {
  const editor = useStore((state) => state.editor)
  const compareMode = useStore((state) => state.compareMode)
  const compareBaseItem = useStore((state) => state.compareBaseItem)
  const activeHistory = useStore((state) => state.activeHistory)

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (!compareMode || !compareBaseItem || !activeHistory) return

    // Read the live doc first. TrailingNode appends an empty paragraph the decoded
    // version JSON does not carry, and any size drift shifts every later decoration.
    const capturedDoc = editor.state.doc
    const jsonA = getCachedProsemirrorFromHistoryYdoc(compareBaseItem.version, compareBaseItem.data)
    if (jsonA == null) return

    const result = buildCompareDecorations(editor.schema, jsonA, capturedDoc.toJSON())
    if ('error' in result) {
      toast.Error("Can't compare this version")
      return
    }

    // Built once, deliberately. `DecorationSet.create` NULLS entries in the array it
    // is given (prosemirror-view `takeSpansForNode`), and only strips nulls on the
    // call that made them — so handing it the same array twice sorts over a null and
    // throws. Building once also keeps the tree off every transaction.
    const decorationSet = DecorationSet.create(capturedDoc, result.decorations)

    const plugin = new Plugin({
      key: historyComparePluginKey,
      props: {
        decorations(state) {
          // DecorationSet.create does not range-check, so a stale set would silently
          // paint the wrong spans of a document that has since been replaced.
          return state.doc === capturedDoc ? decorationSet : DecorationSet.empty
        }
      }
    })

    editor.registerPlugin(plugin)
    return () => {
      if (editor.isDestroyed) return
      editor.unregisterPlugin(historyComparePluginKey)
    }
  }, [editor, compareMode, compareBaseItem, activeHistory])
}
