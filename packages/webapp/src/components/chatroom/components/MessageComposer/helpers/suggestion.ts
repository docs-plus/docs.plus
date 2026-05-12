import {
  autoUpdate,
  computePosition,
  flip,
  hide,
  offset as floatingOffset,
  shift,
  size
} from '@floating-ui/dom'
import { ReactRenderer } from '@tiptap/react'

import MentionList from './MentionList'

export default {
  render: () => {
    let component: any
    let popup: HTMLDivElement | null = null
    let cleanup: (() => void) | null = null
    let virtualElement: { getBoundingClientRect: any } | null = null

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor
        })

        if (!props.clientRect) {
          return
        }

        // Create popup element with proper styling
        popup = document.createElement('div')
        popup.className = 'mention-suggestion-popup'
        popup.style.position = 'absolute'
        popup.style.zIndex = '9999'
        popup.style.maxHeight = '300px'
        popup.style.overflow = 'auto'
        popup.appendChild(component.element)
        document.body.appendChild(popup)

        // Virtual element for positioning; we keep one autoUpdate attached
        // for the popup's lifetime and only swap the rect-getter on update.
        virtualElement = {
          getBoundingClientRect: props.clientRect
        }

        // Smart positioning with autoUpdate - automatically repositions on scroll/resize
        cleanup = autoUpdate(virtualElement, popup, async () => {
          if (!popup || !virtualElement) return

          const { x, y, placement, middlewareData } = await computePosition(virtualElement, popup, {
            placement: 'bottom-start',
            middleware: [
              // Offset from the reference element
              floatingOffset(8),
              // Flip to opposite side if no space
              flip({
                fallbackPlacements: ['top-start', 'bottom-end', 'top-end'],
                padding: 8
              }),
              // Shift along the axis to stay in viewport
              shift({ padding: 8 }),
              // Dynamically adjust size to fit viewport
              size({
                padding: 8,
                apply({ availableHeight, elements }) {
                  Object.assign(elements.floating.style, {
                    maxHeight: `${Math.max(100, availableHeight)}px`
                  })
                }
              }),
              // Hide when reference element is not visible
              hide({ padding: 8 })
            ]
          })

          // Apply positioning
          Object.assign(popup.style, {
            left: `${x}px`,
            top: `${y}px`,
            visibility: middlewareData.hide?.referenceHidden === true ? 'hidden' : 'visible'
          })

          // Add data attribute for current placement (useful for styling)
          popup.setAttribute('data-placement', placement)
        })
      },

      onUpdate(props: any) {
        component.updateProps(props)

        if (!props.clientRect || !virtualElement) {
          return
        }

        // Rebind the rect-getter; the existing autoUpdate listener
        // re-runs on scroll/resize and will pick up the new caret position.
        virtualElement.getBoundingClientRect = props.clientRect
      },

      onKeyDown(props: any) {
        if (!component || !component.ref) {
          return false
        }

        if (props.event.key === 'Escape') {
          if (cleanup) {
            cleanup()
            cleanup = null
          }
          if (popup) {
            popup.remove()
          }
          return true
        }

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
        // Clean up autoUpdate
        if (cleanup) {
          cleanup()
          cleanup = null
        }

        // Remove popup
        if (popup) {
          popup.remove()
          popup = null
        }

        virtualElement = null

        // Destroy component
        if (component) {
          component.destroy()
        }
      },

      parseHTML: () => [
        {
          tag: 'span[data-mention][data-id]',
          getAttrs: (dom: any) => {
            const id = dom.getAttribute('data-id')
            return { id }
          }
        }
      ],

      renderHTML: ({ node }: any) => {
        return [
          'span',
          {
            'data-mention': '',
            'data-id': node.attrs.id,
            class: 'mention'
          },
          `@${node.attrs.label}`
        ]
      }
    }
  }
}
