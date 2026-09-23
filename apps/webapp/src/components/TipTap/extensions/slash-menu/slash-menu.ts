import { flip, shift, size } from '@floating-ui/dom'
import { isDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { exitSuggestion, Suggestion } from '@tiptap/suggestion'

import { renderSlashMenu } from '../../slash/renderSlashMenu'
import { filterSlashItems } from '../../slash/slashItems'
import type { SlashItem } from '../../slash/slashMenuSession'
import { isTitlePos } from '../title-document/title-document'

const slashMenuPluginKey = new PluginKey('slashMenu')

const VIEWPORT_PAD = 8
const MAX_LIST_HEIGHT = 320

// Floating UI 1.8 reads the 'viewport' root boundary from window.visualViewport,
// so pinch zoom and the Safari keyboard size the list, not the layout viewport.
const visualViewportMiddleware = [
  flip({ rootBoundary: 'viewport', padding: VIEWPORT_PAD }),
  shift({ rootBoundary: 'viewport', padding: VIEWPORT_PAD }),
  size({
    rootBoundary: 'viewport',
    padding: VIEWPORT_PAD,
    apply({ availableHeight, elements }) {
      elements.floating.style.maxHeight = `${Math.max(120, Math.min(MAX_LIST_HEIGHT, availableHeight))}px`
    }
  })
]

/**
 * Pad-only `/` insert list (issue #251). It opens only when the whole textblock is the
 * `/query`, so a `/` in a URL, a path or after text stays text. Title, code blocks,
 * the Editing lock and a read-only editor never open it.
 */
export const SlashMenu = Extension.create({
  name: 'slashMenu',
  // Above list, heading and Enter keymaps, so arrows and Enter drive the open list.
  priority: 200,

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey: slashMenuPluginKey,
        char: '/',
        // No spaces: a line like `/usr/bin is…` must close the list at the first space.
        allowedPrefixes: null,
        startOfLine: true,
        decorationClass: 'slash-menu-query',
        // Not the default `is-empty`: the pad placeholder paints `.is-empty::before`.
        decorationEmptyClass: 'slash-menu-query--empty',
        flip: false,
        floatingUi: { strategy: 'fixed', middleware: visualViewportMiddleware },
        allow: ({ editor, state, range }) => {
          if (!editor.isEditable || isDocumentEditingLocked()) return false
          const $from = state.doc.resolve(range.from)
          if ($from.depth === 0 || isTitlePos($from)) return false
          if ($from.parent.type.spec.code) return false
          return range.from === $from.start() && range.to === $from.end()
        },
        items: ({ editor, query }) => filterSlashItems(editor, query),
        command: ({ editor, range, props: item }) => {
          if (!editor.isEditable || isDocumentEditingLocked()) {
            exitSuggestion(editor.view, slashMenuPluginKey)
            return
          }
          editor.chain().focus().deleteRange(range).run()
          item.run(editor)
        },
        render: () => renderSlashMenu(slashMenuPluginKey)
      })
    ]
  }
})
