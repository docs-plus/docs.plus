import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { createDecorationPluginState, createDecorationPluginProps } from './decorationHelpers'
import { TIPTAP_NODES, type EditorView, type ProseMirrorNode, type Editor } from '@types'
import { ChatLeftSVG } from '@icons'
import * as PubSub from 'pubsub-js'
import { CHAT_OPEN } from '@services/eventsHub'

// Plugin-specific types
interface TitleNodeData {
  node: ProseMirrorNode
  pos: number
  to: number
  headingId: string | null
}

// Create title button widget
const createTitleButton = (editor: Editor, { headingId }: { headingId: string | null }) => {
  return (view: EditorView, getPos: () => number | undefined): Node => {
    const button = document.createElement('button')
    button.classList.add(
      'btnOpenChatBox',
      'btn',
      'btn-circle',
      'btn-primary',
      'size-12',
      'min-h-10',
      'shadow-md'
    )

    button.setAttribute('type', 'button')

    // Apply user-select styles more efficiently
    Object.assign(button.style, {
      userSelect: 'none',
      webkitUserSelect: 'none',
      msUserSelect: 'none'
    })

    button.innerHTML = ChatLeftSVG({
      size: 20,
      className: 'chatLeft',
      fill: '#fff'
    })

    // Add event listener with proper error handling
    button.addEventListener('click', function (e: Event) {
      //   e.preventDefault()
      //   e.stopPropagation()
      try {
        // Check if getPos is a function and call it
        const position = getPos?.()

        if (typeof position !== 'number') return

        if (!headingId) {
          console.warn('[ContentHeading]: No heading ID found')
          return
        }

        PubSub.publish(CHAT_OPEN, { headingId })
      } catch (error) {
        console.error('[ContentHeading]: Error handling chat button click', error)
      }
    })

    return button
  }
}

// Find title nodes and return their positions
const findTitleNodes = (doc: ProseMirrorNode): TitleNodeData[] => {
  const result: TitleNodeData[] = []
  let lastHeadingId: string | null = null

  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      lastHeadingId = node.attrs.id
    }
    if (node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
      const headingId = lastHeadingId || null

      result.push({ node, pos, to: pos + node.nodeSize, headingId })
    }
  })

  return result
}

// Create decorations for title buttons
const createTitleButtonDecorations = (doc: ProseMirrorNode, editor: Editor): DecorationSet => {
  const decos: Decoration[] = []
  const titleNodes = findTitleNodes(doc)

  titleNodes.forEach(({ pos, to, node, headingId }: TitleNodeData) => {
    const decorationWidget = Decoration.widget(to - 1, createTitleButton(editor, { headingId }), {
      side: -1,
      key: `title-button-${pos}`,
      ignoreSelection: true
    })

    decos.push(decorationWidget)
  })

  return DecorationSet.create(doc, decos)
}

/**
 * Creates the title buttons plugin for ContentHeading decorations
 * @param editor - TipTap editor instance
 * @returns ProseMirror plugin
 */
export function createTitleButtonsPlugin(editor: Editor): Plugin {
  const targetNodeTypes = [TIPTAP_NODES.HEADING_TYPE, TIPTAP_NODES.CONTENT_HEADING_TYPE]

  const buildDecorations = (doc: ProseMirrorNode): DecorationSet =>
    createTitleButtonDecorations(doc, editor)

  return new Plugin({
    key: new PluginKey('TitleButtons'),
    state: createDecorationPluginState(buildDecorations, targetNodeTypes),
    props: createDecorationPluginProps()
  })
}
