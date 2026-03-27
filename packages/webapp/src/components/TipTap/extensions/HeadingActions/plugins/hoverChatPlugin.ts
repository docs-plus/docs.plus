import { AddCommentSVG, ChatLeftSVG } from '@icons'
import { CHAT_COMMENT, CHAT_OPEN } from '@services/eventsHub'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { type Editor, type ProseMirrorNode, TIPTAP_NODES } from '@types'
import * as PubSub from 'pubsub-js'

import {
  createDecorationPluginProps,
  createDecorationPluginState
} from '../../plugins/decorationHelpers'
import { HEADING_ACTIONS_CLASSES, type HeadingNodeData } from '../types'

type WidgetFactory = (view: EditorView, getPos: () => number | undefined) => HTMLElement

const createChatButton = (headingId: string, editor: Editor): HTMLButtonElement => {
  const button = document.createElement('button')
  button.classList.add(
    HEADING_ACTIONS_CLASSES.chatBtn,
    'btn',
    'btn-circle',
    'btn-primary',
    'size-12',
    'min-h-10',
    'shadow-md'
  )
  button.setAttribute('type', 'button')
  button.setAttribute('title', 'Open chat')
  button.dataset.headingId = headingId

  Object.assign(button.style, {
    userSelect: 'none',
    webkitUserSelect: 'none',
    msUserSelect: 'none'
  })

  button.innerHTML = ChatLeftSVG({
    size: 20,
    className: 'chatLeft',
    fill: 'currentColor'
  })

  button.addEventListener('click', (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    PubSub.publish(CHAT_OPEN, { headingId })

    const { selection } = editor.state
    if (!selection.empty) {
      editor.commands.setTextSelection(selection.to)
    }
  })

  return button
}

const createCommentButton = (headingId: string, editor: Editor): HTMLButtonElement => {
  const button = document.createElement('button')
  button.classList.add(
    HEADING_ACTIONS_CLASSES.commentBtn,
    'btn',
    'btn-circle',
    'btn-primary',
    'size-12',
    'min-h-10',
    'shadow-md'
  )
  button.setAttribute('type', 'button')
  button.setAttribute('title', 'Add comment')

  button.innerHTML = AddCommentSVG({ size: 22, fill: 'currentColor' })

  button.addEventListener('click', (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    const { selection } = editor.state
    if (selection.empty) return

    PubSub.publish(CHAT_COMMENT, {
      content: editor.state.doc.textBetween(selection.from, selection.to, '\n'),
      html: '',
      headingId
    })

    editor.commands.setTextSelection(selection.to)
  })

  return button
}

const createHoverChatWidget = (editor: Editor, headingId: string): WidgetFactory => {
  return () => {
    const wrapper = document.createElement('div')
    wrapper.classList.add(HEADING_ACTIONS_CLASSES.wrap)
    wrapper.dataset.headingId = headingId

    const singleBtn = createChatButton(headingId, editor)
    singleBtn.classList.add(HEADING_ACTIONS_CLASSES.single)

    const group = document.createElement('div')
    group.classList.add(HEADING_ACTIONS_CLASSES.group)
    group.appendChild(createChatButton(headingId, editor))
    group.appendChild(createCommentButton(headingId, editor))

    wrapper.appendChild(singleBtn)
    wrapper.appendChild(group)

    return wrapper
  }
}

const findHeadingNodes = (doc: ProseMirrorNode): HeadingNodeData[] => {
  const result: HeadingNodeData[] = []

  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      const headingId = (node.attrs['toc-id'] as string) || null
      result.push({ to: pos + node.nodeSize, headingId })
      return false
    }
  })

  return result
}

const createHoverChatDecorations = (doc: ProseMirrorNode, editor: Editor): DecorationSet => {
  const decos: Decoration[] = []
  const headingNodes = findHeadingNodes(doc)

  headingNodes.forEach(({ to, headingId }: HeadingNodeData) => {
    if (!headingId) return

    const decorationWidget = Decoration.widget(to - 1, createHoverChatWidget(editor, headingId), {
      side: -1,
      key: `hover-chat-${headingId}`,
      ignoreSelection: true
    })

    decos.push(decorationWidget)
  })

  return DecorationSet.create(doc, decos)
}

let activeWrapper: HTMLElement | null = null
let lastSelectionHeadingId: string | null = null

const findSelectionHeadingId = (view: EditorView): string | null => {
  const { selection } = view.state
  if (selection.empty) return null

  const { $anchor } = selection
  if ($anchor.parent.type.name === TIPTAP_NODES.HEADING_TYPE) {
    return ($anchor.parent.attrs['toc-id'] as string) || null
  }

  return null
}

const updateSelectionState = (view: EditorView): void => {
  const headingId = findSelectionHeadingId(view)

  if (headingId === lastSelectionHeadingId) return
  lastSelectionHeadingId = headingId

  if (activeWrapper) {
    activeWrapper.classList.remove(HEADING_ACTIONS_CLASSES.hasSelection)
    activeWrapper = null
  }

  if (!headingId) return

  const wrapper = view.dom.querySelector<HTMLElement>(
    `.${HEADING_ACTIONS_CLASSES.wrap}[data-heading-id="${headingId}"]`
  )
  if (wrapper) {
    wrapper.classList.add(HEADING_ACTIONS_CLASSES.hasSelection)
    activeWrapper = wrapper
  }
}

export function createHoverChatPlugin(editor: Editor): Plugin {
  const targetNodeTypes = [TIPTAP_NODES.HEADING_TYPE]

  const buildDecorations = (doc: ProseMirrorNode): DecorationSet =>
    createHoverChatDecorations(doc, editor)

  return new Plugin({
    key: new PluginKey('hoverChat'),
    state: createDecorationPluginState(buildDecorations, targetNodeTypes),
    props: createDecorationPluginProps(),
    view() {
      return {
        update: (view: EditorView) => {
          updateSelectionState(view)
        }
      }
    }
  })
}
