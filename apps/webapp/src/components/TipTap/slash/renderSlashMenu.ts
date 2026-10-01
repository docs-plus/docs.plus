import { popoverPanelClassName } from '@components/ui/Popover'
import { useSheetStore } from '@stores'
import type { Editor } from '@tiptap/core'
import type { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import {
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionProps
} from '@tiptap/suggestion'
import { twMerge } from '@utils/twMerge'

import { isPhone } from './slashItems'
import SlashMenuList from './SlashMenuList'
import {
  moveSlashSelection,
  pickSlashSelection,
  setSlashSession,
  SLASH_LISTBOX_ID,
  type SlashItem,
  slashSelectedIndex
} from './slashMenuSession'

type SlashProps = SuggestionProps<SlashItem, SlashItem>

export function renderSlashMenu(pluginKey: PluginKey) {
  let component: ReactRenderer | null = null
  let unmount: (() => void) | null = null
  let stopSheetSync: (() => void) | null = null
  let editor: Editor | null = null
  let lastQuery: string | null = null

  // A remote edit can shift the range with the same query. Keep the highlight then.
  // Skip the empty `loading` pass the plugin sends before `items()` resolves, or it drops the highlight.
  const sync = (props: SlashProps) => {
    if (props.loading) return
    const { items } = props
    const selectedIndex =
      props.query === lastQuery ? Math.min(slashSelectedIndex(), items.length - 1) : 0
    lastQuery = props.query
    setSlashSession({
      items,
      selectedIndex: Math.max(0, selectedIndex),
      pick: (item) => props.command(item)
    })
  }

  return {
    onStart: (props: SlashProps) => {
      editor = props.editor
      editor.view.dom.setAttribute('aria-controls', SLASH_LISTBOX_ID)

      if (isPhone()) {
        useSheetStore.getState().openSheet('slashMenu', { editor: props.editor })
        // Backdrop, drag or X closed the sheet: end the query and keep the typed text.
        stopSheetSync = useSheetStore.subscribe(
          (state) => state.activeSheet,
          (active) => {
            if (active !== 'slashMenu' && editor && !editor.isDestroyed) {
              exitSuggestion(editor.view, pluginKey)
            }
          }
        )
        return
      }

      // `mount` sets `width: max-content` inline, so the class sets only a floor.
      // `size` in the extension writes max-height, so the frame scrolls.
      component = new ReactRenderer(SlashMenuList, {
        editor: props.editor,
        props: { editor: props.editor },
        className: twMerge(
          popoverPanelClassName,
          'w-auto min-w-[11rem] overflow-y-auto overscroll-contain'
        )
      })
      component.element.setAttribute('data-testid', 'slash-menu-popup')
      unmount = props.mount(component.element as HTMLElement)
    },

    onUpdate: (props: SlashProps) => sync(props),

    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowDown') return moveSlashSelection(1)
      if (event.key === 'ArrowUp') return moveSlashSelection(-1)
      if (event.key === 'Enter') return pickSlashSelection()
      return false
    },

    onExit: () => {
      stopSheetSync?.()
      stopSheetSync = null
      const sheets = useSheetStore.getState()
      if (sheets.activeSheet === 'slashMenu') sheets.closeSheet()
      unmount?.()
      unmount = null
      component?.destroy()
      component = null
      setSlashSession(null)
      lastQuery = null
      editor?.view.dom.removeAttribute('aria-controls')
      editor?.view.dom.removeAttribute('aria-activedescendant')
      editor = null
    }
  }
}
