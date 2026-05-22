import {
  autoUpdate,
  computePosition,
  flip,
  hide,
  offset as floatingOffset,
  size
} from '@floating-ui/dom'
import type { Editor } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'

import { dismissComposerOverlaysBeforeMention } from './dismissComposerOverlays'
import MentionList, { type MentionListRef } from './MentionList'
import { setMentionPopupOpen, syncMentionPickerActive } from './mentionTypes'

type MentionSuggestionRenderProps = {
  editor: Editor
  query: string
  command: (item: { id: string; label: string }) => void
}

const COMPOSER_SURFACE_SELECTOR = '[data-chat-composer-surface]'
const WIDTH_RATIO = 0.99
const SIDE_INSET_RATIO = (1 - WIDTH_RATIO) / 2

const POPUP_CLASS =
  'mention-suggestion-popup bg-base-100 border-base-300 z-[9999] overflow-hidden rounded-lg border shadow-md'

function getComposerSurface(editor: Editor): HTMLElement | null {
  return editor.view.dom.closest(COMPOSER_SURFACE_SELECTOR)
}

function rectFromSurface(surface: HTMLElement): DOMRect {
  return surface.getBoundingClientRect()
}

export default {
  render: () => {
    let component: ReactRenderer<MentionListRef> | null = null
    let popup: HTMLDivElement | null = null
    let cleanup: (() => void) | null = null
    let surface: HTMLElement | null = null

    const destroyPopup = () => {
      setMentionPopupOpen(false)
      cleanup?.()
      cleanup = null
      popup?.remove()
      popup = null
      component?.destroy()
      component = null
      surface = null
    }

    return {
      onStart: (props: MentionSuggestionRenderProps) => {
        dismissComposerOverlaysBeforeMention()

        surface = getComposerSurface(props.editor)
        if (!surface) {
          console.warn(
            '[mention] missing [data-chat-composer-surface] on composer host — popup not shown'
          )
          return
        }

        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor
        })

        popup = document.createElement('div')
        popup.className = POPUP_CLASS
        popup.style.position = 'absolute'
        popup.appendChild(component.element)
        document.body.appendChild(popup)
        setMentionPopupOpen(true)

        const virtualElement = {
          getBoundingClientRect: () => rectFromSurface(surface!)
        }

        cleanup = autoUpdate(surface, popup, async () => {
          if (!popup || !surface) return

          const refRect = rectFromSurface(surface)
          const inset = refRect.width * SIDE_INSET_RATIO
          const pickerWidth = refRect.width * WIDTH_RATIO

          const { y, middlewareData } = await computePosition(virtualElement, popup, {
            placement: 'top-start',
            middleware: [
              floatingOffset(6),
              flip({
                fallbackPlacements: ['bottom-start'],
                padding: 8
              }),
              size({
                padding: 8,
                apply({ availableHeight, elements }) {
                  Object.assign(elements.floating.style, {
                    width: `${pickerWidth}px`,
                    minWidth: `${pickerWidth}px`,
                    maxWidth: `${pickerWidth}px`,
                    maxHeight: `${Math.max(100, availableHeight)}px`
                  })
                }
              }),
              hide({ padding: 8 })
            ]
          })

          Object.assign(popup.style, {
            left: `${refRect.x + inset}px`,
            top: `${y}px`,
            visibility: middlewareData.hide?.referenceHidden === true ? 'hidden' : 'visible'
          })
          syncMentionPickerActive()
        })
      },

      onUpdate(props: MentionSuggestionRenderProps) {
        component?.updateProps(props)
      },

      onKeyDown(props: { event: KeyboardEvent }) {
        // Return false so @tiptap/suggestion runs onExit + dispatchExit (true skips that path).
        if (props.event.key === 'Escape') {
          return false
        }

        if (!component?.ref) return false

        if (['ArrowUp', 'ArrowDown', 'Enter'].includes(props.event.key)) {
          const result = component.ref.onKeyDown(props)

          if (result) {
            props.event.preventDefault()
            return true
          }
        }

        return false
      },

      onExit() {
        destroyPopup()
      }
    }
  }
}
