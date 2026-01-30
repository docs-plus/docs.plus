import {
  autoUpdate,
  computePosition,
  flip,
  hide,
  offset as floatingOffset,
  shift,
  size} from '@floating-ui/dom'
import { ReactRenderer } from '@tiptap/react'

import MentionList from './MentionList'

export default {
  render: () => {
    let component: any
    let popup: HTMLDivElement | null = null
    let cleanup: (() => void) | null = null

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

        // Virtual element for positioning
        const virtualElement = {
          getBoundingClientRect: props.clientRect
        }

        // Smart positioning with autoUpdate - automatically repositions on scroll/resize
        cleanup = autoUpdate(virtualElement, popup, async () => {
          if (!popup) return

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

        if (!props.clientRect) {
          return
        }

        // Position updates automatically via autoUpdate
        // Just update the virtual element's reference
        if (popup) {
          const virtualElement = {
            getBoundingClientRect: props.clientRect
          }

          // Restart autoUpdate with new reference
          if (cleanup) {
            cleanup()
          }

          cleanup = autoUpdate(virtualElement, popup, async () => {
            if (!popup) return

            const { x, y, placement, middlewareData } = await computePosition(
              virtualElement,
              popup,
              {
                placement: 'bottom-start',
                middleware: [
                  floatingOffset(8),
                  flip({
                    fallbackPlacements: ['top-start', 'bottom-end', 'top-end'],
                    padding: 8
                  }),
                  shift({ padding: 8 }),
                  size({
                    padding: 8,
                    apply({ availableHeight, elements }) {
                      Object.assign(elements.floating.style, {
                        maxHeight: `${Math.max(100, availableHeight)}px`
                      })
                    }
                  }),
                  hide({ padding: 8 })
                ]
              }
            )

            Object.assign(popup.style, {
              left: `${x}px`,
              top: `${y}px`,
              visibility: middlewareData.hide?.referenceHidden === true ? 'hidden' : 'visible'
            })

            popup.setAttribute('data-placement', placement)
          })
        }
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
