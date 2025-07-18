import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'

import MentionList from './MentionList'

export default {
  render: () => {
    let component: any
    let popup: any

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          zIndex: 9999
        })
      },

      onUpdate(props: any) {
        component.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect
        })
      },

      onKeyDown(props: any) {
        if (!component || !component.ref) {
          return false
        }

        if (props.event.key === 'Escape') {
          popup[0].hide()
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
        if (popup && popup[0]) {
          popup[0].destroy()
        }
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
