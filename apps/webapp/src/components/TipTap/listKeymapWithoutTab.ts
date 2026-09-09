import { ListKeymap } from '@tiptap/extension-list'

/**
 * StarterKit 3.30+ ListKeymap Tab sinks a following paragraph into the previous
 * list. Indent already owns Tab (list sink, table cell, then literal indent).
 */
export const ListKeymapWithoutTab = ListKeymap.extend({
  addKeyboardShortcuts() {
    const { Tab: _tab, ...rest } = this.parent?.() ?? {}
    return rest
  }
})
