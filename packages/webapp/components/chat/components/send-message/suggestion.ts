/* eslint-disable */
// @ts-nocheck

import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'

import MentionList from './MentionList.tsx'

export default {
  render: () => {
    let component
    let popup

    return {
      onStart: (props) => {
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
          placement: 'bottom-start'
        })
      },

      onUpdate(props) {
        component.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect
        })
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup[0].hide()

          return true
        }

        return component.ref?.onKeyDown(props)
      },

      onExit() {
        popup[0].destroy()
        component.destroy()
      },

      parseHTML: () => [
        {
          tag: 'span[data-mention][data-id]',
          getAttrs: (dom) => {
            const id = dom.getAttribute('data-id')
            return { id }
          }
        }
      ],

      renderHTML: ({ node }) => {
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
