import { getAttributes } from '@tiptap/core'
import { Editor } from '@tiptap/core'
import { MarkType } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'

import { createFloatingToolbar, hideCurrentToolbar } from '../helpers/floating-toolbar'

// Define type for the ClickHandlerOptions
type ClickHandlerOptions = {
  type: MarkType
  editor: Editor
  validate?: (url: string) => boolean
  view: EditorView
  popover?: ((options: any) => HTMLElement) | null
}

// Helper: Get link element coordinates
const getLinkCoordinates = (linkElement: HTMLElement) => {
  const rect = linkElement.getBoundingClientRect()
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  }
}

// Helper: Handle click/touch on hyperlink
const clickAndTouchHandler = (
  event: MouseEvent | TouchEvent,
  options: ClickHandlerOptions,
  clickPos: number | undefined
): boolean => {
  const target = event.target as HTMLElement
  const link = target?.closest('a')

  // If no link found, do nothing
  if (!link) return false

  // Get link attributes
  const attrs = getAttributes(options.view.state, options.type.name)
  const href = link.href || attrs.href
  const target_attr = link.target || attrs.target

  // If no modal provided, open link directly
  if (!options.popover) {
    if (href) {
      window.open(href, target_attr)
    }
    return true
  }

  // If no href, hide any existing toolbar
  if (!href) {
    hideCurrentToolbar()
    return true
  }

  event.preventDefault()

  // Set cursor position to the clicked position
  if (clickPos !== undefined) {
    const { from, to } = options.view.state.selection
    const setTextSelectionPos = from === to ? clickPos : { from, to }

    options.editor
      .chain()
      .focus(clickPos === 0 ? 'start' : clickPos)
      .setTextSelection(setTextSelectionPos)
      .run()
  }

  // Get link position for toolbar placement
  const linkCoords = getLinkCoordinates(link)
  const nodePos = options.view.posAtDOM(target, 0)

  // Create hyperlink preview content
  const hyperlinkPreview = options.popover({
    attrs,
    link,
    nodePos,
    linkCoords,
    ...options
  })

  // If no preview content, hide toolbar
  if (!hyperlinkPreview) {
    hideCurrentToolbar()
    return true
  }

  // Create floating toolbar with coordinate-based positioning
  const toolbar = createFloatingToolbar({
    referenceElement: link,
    content: hyperlinkPreview,
    placement: 'bottom',
    offset: 8,
    showArrow: true,
    enableKeyboardNav: true,
    onError: (error) => console.error('Hyperlink preview toolbar error:', error)
  })

  // Show the toolbar
  toolbar.show()

  return true
}

/**
 * @description This plugin is used to handle the click and touch events on the hyperlink. to show the preview hyperlink popover.
 * @param options - The options for the plugin.
 * @returns A plugin that handles the click and touch events on the hyperlink.
 */
export default function HyperLinkClickHandlerPlugin(options: ClickHandlerOptions): Plugin {
  return new Plugin({
    key: new PluginKey('HyperLinkClickHandler'),
    props: {
      handleDOMEvents: {
        touchend: (view: EditorView, event: TouchEvent) => {
          const { clientX, clientY } = event.changedTouches[0]
          const pos = view.posAtCoords({ left: clientX, top: clientY })

          return clickAndTouchHandler(event, options, pos?.pos)
        },

        click: (view: EditorView, event: MouseEvent) => {
          // Only handle left clicks
          if (event?.button !== 0) return false

          const coords = { left: event.clientX, top: event.clientY }
          const pos = view.posAtCoords(coords)

          return clickAndTouchHandler(event, options, pos?.pos)
        }
      }
    }
  })
}
