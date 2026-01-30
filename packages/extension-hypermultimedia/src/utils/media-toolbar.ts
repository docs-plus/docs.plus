import { Editor } from '@tiptap/core'
import { EditorView } from '@tiptap/pm/view'

// import { hideCurrentToolbar } from './floating-toolbar'
import { HIDE_RESIZE_GRIPPER_META } from '../extensions/decorationHelpers'
import { hideCurrentToolbar } from './floating-toolbar'
import * as Icons from './icons'

const MARGIN_OPTIONS = [
  { value: '0in', text: '0"' },
  { value: '0.06in', text: '1/16"' },
  { value: '0.13in', text: '1/8"' },
  { value: '0.25in', text: '1/4"' },
  { value: '0.38in', text: '3/8"' },
  { value: '0.5in', text: '1/2"' },
  { value: '0.75in', text: '3/4"' },
  { value: '1in', text: '1"' }
]

export interface MediaToolbarOptions {
  target: HTMLElement
  view: EditorView
  editor: Editor
  nodeType: string
}

const TOOLBAR_CLASSES = 'media-toolbar'
const BUTTON_CLASSES = 'media-toolbar__button'
const SELECT_CLASSES = 'media-toolbar__select'

type PlacementAction = () => void

interface PlacementConfig {
  icon: string
  title: string
  action: PlacementAction
  isActive: boolean
}

export const applyStyleAndAttributes = (
  element: HTMLElement,
  style: string | object,
  attributes: Record<string, any>,
  editor: Editor,
  nodePos: number
) => {
  // Apply styles to element
  Object.assign(element.style, style)

  // Start a new transaction
  const { state, dispatch } = editor.view
  let transaction = state.tr

  const node = transaction.doc.nodeAt(nodePos)

  if (node) {
    // Set each attribute individually using setNodeAttribute
    Object.keys(attributes).forEach((key) => {
      transaction.setNodeAttribute(nodePos, key, attributes[key])
    })
    // Hide resize gripper when attributes change
    transaction.setMeta(HIDE_RESIZE_GRIPPER_META, true)

    dispatch(transaction)
  }
}

const createPlacementButton = ({
  icon,
  title,
  action,
  isActive
}: PlacementConfig): HTMLButtonElement => {
  const button = document.createElement('button')
  button.className = isActive ? `${BUTTON_CLASSES} ${BUTTON_CLASSES}--active` : BUTTON_CLASSES
  button.innerHTML = icon
  button.title = title
  button.onclick = action
  return button
}

const getCurrentPlacement = (mediaNodeAttrs: Record<string, any>): string => {
  const { float, display, margin } = mediaNodeAttrs

  if (float === 'left') return 'float-left'
  if (float === 'right') return 'float-right'
  if (display === 'block' && margin === 'auto') return 'center'
  return 'inline'
}

const createPlacementConfigs = (
  wrapper: HTMLElement,
  nodePos: number,
  editor: Editor,
  mediaNodeAttrs: Record<string, any>
): PlacementConfig[] => {
  const { margin: mediaMargin = '0.5in' } = mediaNodeAttrs
  const currentPlacement = getCurrentPlacement(mediaNodeAttrs)

  return [
    {
      icon: Icons.Inline({ fill: '#374151', size: 20 }),
      title: 'Inline',
      isActive: currentPlacement === 'inline',
      action: () =>
        applyPlacement(
          wrapper,
          { display: 'block', float: 'none', clear: 'none', margin: '0' },
          editor,
          nodePos
        )
    },
    {
      icon: Icons.InlineCenter({ fill: '#374151', size: 20 }),
      title: 'Center',
      isActive: currentPlacement === 'center',
      action: () =>
        applyPlacement(
          wrapper,
          {
            display: 'block',
            float: 'none',
            clear: 'none',
            margin: 'auto'
          },
          editor,
          nodePos
        )
    },
    {
      icon: Icons.Left({ fill: '#374151', size: 20 }),
      title: 'Float Left',
      isActive: currentPlacement === 'float-left',
      action: () =>
        applyPlacement(
          wrapper,
          { display: 'block', float: 'left', clear: 'none', margin: mediaMargin },
          editor,
          nodePos
        )
    },
    {
      icon: Icons.Right({ fill: '#374151', size: 20 }),
      title: 'Float Right',
      isActive: currentPlacement === 'float-right',
      action: () =>
        applyPlacement(
          wrapper,
          { display: 'block', float: 'right', clear: 'none', margin: mediaMargin },
          editor,
          nodePos
        )
    }
  ]
}

const applyPlacement = (
  wrapper: HTMLElement,
  styles: Record<string, string>,
  editor: Editor,
  nodePos: number
): void => {
  applyStyleAndAttributes(wrapper, styles, styles, editor, nodePos)
  hideCurrentToolbar()
  // floatingToolbar.hide()
}

const createMarginSelect = (
  wrapper: HTMLElement,
  nodePos: number,
  editor: Editor,
  mediaNodeAttrs: Record<string, any>
): HTMLSelectElement => {
  const select = document.createElement('select')
  select.className = SELECT_CLASSES
  select.title = 'Margin'

  const { margin = '0.5in' } = mediaNodeAttrs

  const options = MARGIN_OPTIONS.map(({ value, text }) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = `${text} margin`
    option.selected = margin === value
    return option
  })

  console.log('createMarginSelect', { options })
  select.append(...options)
  select.onchange = (e) => handleMarginChange(e, wrapper, nodePos, editor)

  return select
}

const handleMarginChange = (
  event: Event,
  wrapper: HTMLElement,
  nodePos: number,
  editor: Editor
): void => {
  const selectElement = event.target as HTMLSelectElement
  const newMargin = selectElement.value

  // Update node attribute
  const { state, dispatch } = editor.view

  // Start a new transaction
  let transaction = state.tr

  const node = transaction.doc.nodeAt(nodePos)

  console.log('node', { node, nodePos })

  if (node) {
    transaction.setNodeAttribute(nodePos, 'margin', newMargin)
    // Hide resize gripper when attribute changes
    transaction.setMeta(HIDE_RESIZE_GRIPPER_META, true)
    dispatch(transaction)
  }

  // Apply visual style
  wrapper.style.margin = newMargin
  hideCurrentToolbar()
  // floatingToolbar.hide()
}

export const createMediaToolbar = ({ target, view, editor, nodeType }: MediaToolbarOptions) => {
  const wrapper = target.parentElement || target
  const nodePos = view.posAtDOM(wrapper, 0)
  const { attrs: mediaNodeAttrs = {} } = editor.state.doc.nodeAt(nodePos) || {}

  // create a container for the toolbar
  const toolbarContainer = document.createElement('div')
  toolbarContainer.className = TOOLBAR_CLASSES
  toolbarContainer.setAttribute('data-node-type', nodeType)

  const placements = createPlacementConfigs(wrapper, nodePos, editor, mediaNodeAttrs)
  const placementButtons = placements.map(createPlacementButton)

  const toolbarElements: HTMLElement[] = [...placementButtons]

  // Only show margin selector when floating
  if (mediaNodeAttrs.float && mediaNodeAttrs.float !== 'none') {
    const marginSelect = createMarginSelect(wrapper, nodePos, editor, mediaNodeAttrs)
    toolbarElements.push(marginSelect)
  }

  toolbarContainer.append(...toolbarElements)

  return toolbarContainer
}
