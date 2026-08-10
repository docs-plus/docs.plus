import { useStore } from '@stores'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { useEffect, useRef } from 'react'

const historyAuthorsPluginKey = new PluginKey<DecorationSet>('historyAuthors')

type Params = {
  ranges: { from: number; to: number }[] | null
  markedIndices: ReadonlySet<number>
  focusedIndex: number | null
  onBlockClick: (index: number) => void
}

/**
 * Marks one person's blocks on the read-only history editor. The set lives in plugin
 * state and moves by transaction metadata. Switching person therefore never reconfigures
 * the editor. A reconfigure rebuilds node views and reloads every media embed.
 */
export const useHistoryAuthorDecorations = ({
  ranges,
  markedIndices,
  focusedIndex,
  onBlockClick
}: Params) => {
  const editor = useStore((state) => state.editor)
  const blockCountRef = useRef(0)
  const onBlockClickRef = useRef(onBlockClick)
  onBlockClickRef.current = onBlockClick

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const plugin = new Plugin<DecorationSet>({
      key: historyAuthorsPluginKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, value) {
          // A version switch replaces the whole document. Refuse to guess rather
          // than repaint a set built for content that is gone.
          if (tr.docChanged) return DecorationSet.empty
          const next = tr.getMeta(historyAuthorsPluginKey)
          return next === undefined ? value : (next as DecorationSet)
        }
      },
      props: {
        decorations: (state) => historyAuthorsPluginKey.getState(state) ?? DecorationSet.empty,
        handleClick: (view, pos) => {
          // Never hijack a click that ends a text selection: reading a version and
          // copying out of it has to keep working.
          if (!view.state.selection.empty) return false
          const index = view.state.doc.resolve(pos).index(0)
          if (index >= 0 && index < blockCountRef.current) onBlockClickRef.current(index)
          return false
        }
      }
    })

    editor.registerPlugin(plugin)
    return () => {
      if (editor.isDestroyed) return
      editor.unregisterPlugin(historyAuthorsPluginKey)
    }
  }, [editor])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    blockCountRef.current = ranges?.length ?? 0

    const decorations: Decoration[] = []
    ranges?.forEach((range, index) => {
      const marked = markedIndices.has(index)
      const focused = index === focusedIndex
      if (!marked && !focused) return
      const className = [
        marked && 'history-author-block',
        focused && 'history-author-block--current'
      ]
        .filter(Boolean)
        .join(' ')
      // `class` only, never `nodeName`: a nodeName decoration re-parents the node's
      // DOM into a new wrapper, which reloads an iframe embed.
      decorations.push(Decoration.node(range.from, range.to, { class: className }))
    })

    // One set, built from a fresh array each time. `DecorationSet.create` consumes
    // the array it is given, so a reused array sorts over a null on the next call.
    const set = decorations.length
      ? DecorationSet.create(editor.state.doc, decorations)
      : DecorationSet.empty
    editor.view.dispatch(editor.state.tr.setMeta(historyAuthorsPluginKey, set))
  }, [editor, ranges, markedIndices, focusedIndex])
}
