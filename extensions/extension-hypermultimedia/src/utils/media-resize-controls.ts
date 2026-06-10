import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

import { closeMediaToolbar, openMediaToolbar } from '../toolbar/mount'
import {
  findGripperForMedia,
  findMediaTarget,
  getMediaNodeType,
  hasFinePointer,
  isInsideMediaControlsUI,
  isInteractiveEmbed,
  resolveMediaFromGripper
} from './media-target'

/** Grace period to traverse from the inline bar to the detached `…`/submenu popovers. */
const HOVER_HIDE_DELAY_MS = 250

interface MediaControlsState {
  activeTarget: HTMLElement | null
  activeNodePos: number | null
  selectionLocked: boolean
  mediaResizing: boolean
  listenersAttached: boolean
  hoverHideTimer: ReturnType<typeof setTimeout> | null
  pointerX: number
  pointerY: number
  pointerMoveAttached: boolean
  onPointerOutside: (event: PointerEvent) => void
  onDocumentKeyDown: (event: KeyboardEvent) => void
  onWindowResize: () => void
  onPointerMove: (event: PointerEvent) => void
}

const controlsByEditor = new WeakMap<Editor, MediaControlsState>()

function createControlsState(editor: Editor): MediaControlsState {
  return {
    activeTarget: null,
    activeNodePos: null,
    selectionLocked: false,
    mediaResizing: false,
    listenersAttached: false,
    hoverHideTimer: null,
    pointerX: 0,
    pointerY: 0,
    pointerMoveAttached: false,
    onPointerOutside: (event) => handlePointerOutside(editor, event),
    onDocumentKeyDown: (event) => handleMediaDeleteKey(editor, event),
    onWindowResize: () => hideMediaResizeControls(editor),
    onPointerMove: (event) => {
      const state = getControlsState(editor)
      state.pointerX = event.clientX
      state.pointerY = event.clientY
    }
  }
}

function getControlsState(editor: Editor): MediaControlsState {
  let state = controlsByEditor.get(editor)
  if (!state) {
    state = createControlsState(editor)
    controlsByEditor.set(editor, state)
  }
  return state
}

function clearActiveState(state: MediaControlsState): void {
  state.activeTarget = null
  state.activeNodePos = null
  state.selectionLocked = false
  state.mediaResizing = false
}

function canUseHoverChrome(state: MediaControlsState, finePointer: boolean): boolean {
  return finePointer && !state.selectionLocked
}

function isDeleteKey(event: KeyboardEvent): boolean {
  return event.key === 'Delete' || event.key === 'Backspace'
}

function isFormControlInMediaUI(element: Element | null): boolean {
  if (!(element instanceof HTMLElement) || !isInsideMediaControlsUI(element)) {
    return false
  }
  const tag = element.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** The caption is editable chrome in node content; its Backspace/Delete must edit text, not nuke the node. */
function isEditingMediaCaption(element: Element | null): boolean {
  return element instanceof HTMLElement && element.closest('.hm-caption') != null
}

/** Set by the drag layer so hover-out/outside-pointer don't tear down controls mid-drag. */
export function setMediaResizing(editor: Editor, active: boolean): void {
  getControlsState(editor).mediaResizing = active
}

export function positionResizeGripper(gripper: HTMLElement, target: HTMLElement): void {
  gripper.style.width = `${target.clientWidth}px`
  gripper.style.height = `${target.clientHeight}px`
  gripper.style.left = `${target.offsetLeft}px`
  gripper.style.top = `${target.offsetTop}px`
}

export function activateResizeGripper(gripper: HTMLElement, target: HTMLElement): void {
  positionResizeGripper(gripper, target)
  gripper.classList.add('hypermultimedia__resize-gripper--active')
}

export function deactivateResizeGripper(gripper: HTMLElement): void {
  gripper.classList.remove(
    'hypermultimedia__resize-gripper--active',
    'hypermultimedia__resize-gripper--dragging'
  )
  gripper.style.width = ''
  gripper.style.height = ''
  gripper.style.left = ''
  gripper.style.top = ''
}

/** Active grippers whose media sibling is gone (delete, cut, collab) must not linger in the DOM. */
export function purgeOrphanedResizeChrome(root: ParentNode = document): void {
  root.querySelectorAll('.hypermultimedia__resize-gripper--active').forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    const media = resolveMediaFromGripper(node, root)
    if (!media || !findMediaTarget(media, root)) {
      deactivateResizeGripper(node)
    }
  })
}

function cancelHoverHide(state: MediaControlsState): void {
  if (state.hoverHideTimer != null) {
    window.clearTimeout(state.hoverHideTimer)
    state.hoverHideTimer = null
  }
}

function isPointerOverActiveChrome(editor: Editor): boolean {
  const state = getControlsState(editor)
  if (!state.activeTarget) return false

  const hit = document.elementFromPoint(state.pointerX, state.pointerY)
  if (!(hit instanceof HTMLElement)) return false
  if (isInsideMediaControlsUI(hit)) return true
  return findMediaTarget(hit, editor.view.dom) === state.activeTarget
}

function scheduleHoverHide(editor: Editor, event?: MouseEvent): void {
  const state = getControlsState(editor)
  if (event) {
    state.pointerX = event.clientX
    state.pointerY = event.clientY
  }

  cancelHoverHide(state)
  state.hoverHideTimer = window.setTimeout(() => {
    state.hoverHideTimer = null
    if (!isPointerOverActiveChrome(editor)) hideMediaResizeControls(editor)
  }, HOVER_HIDE_DELAY_MS)
}

function setPointerTracking(editor: Editor, state: MediaControlsState, attach: boolean): void {
  if (state.pointerMoveAttached === attach) return
  if (attach) {
    document.addEventListener('pointermove', state.onPointerMove, { passive: true })
  } else {
    document.removeEventListener('pointermove', state.onPointerMove)
  }
  state.pointerMoveAttached = attach
}

export function hideMediaResizeControls(editor: Editor): void {
  const state = getControlsState(editor)
  const gripper = state.activeTarget
    ? findGripperForMedia(state.activeTarget, editor.view.dom)
    : null

  cancelHoverHide(state)
  setPointerTracking(editor, state, false)
  if (gripper) deactivateResizeGripper(gripper)
  closeMediaToolbar(state.activeTarget)
  clearActiveState(state)
  setOutsideListeners(state, false)
  purgeOrphanedResizeChrome(editor.view.dom)
}

/** Tear down when the node behind the active controls has left the document (delete, cut, remote edit). */
export function syncControlsToDoc(editor: Editor): void {
  const state = getControlsState(editor)
  if (state.mediaResizing) return
  // Idle chrome ⇒ nothing to tear down; skip the document-wide orphan scan on every transaction.
  if (!state.activeTarget && !state.listenersAttached) return
  if (state.activeTarget && !state.activeTarget.isConnected) {
    hideMediaResizeControls(editor)
    return
  }
  purgeOrphanedResizeChrome(editor.view.dom)
}

// Scroll is not a teardown trigger: gripper rides content; toolbar tracks via autoUpdate.
function setOutsideListeners(state: MediaControlsState, attach: boolean): void {
  if (state.listenersAttached === attach) return

  if (attach) {
    document.addEventListener('pointerdown', state.onPointerOutside, true)
    document.addEventListener('keydown', state.onDocumentKeyDown, true)
    window.addEventListener('resize', state.onWindowResize)
  } else {
    document.removeEventListener('pointerdown', state.onPointerOutside, true)
    document.removeEventListener('keydown', state.onDocumentKeyDown, true)
    window.removeEventListener('resize', state.onWindowResize)
  }

  state.listenersAttached = attach
}

function handlePointerOutside(editor: Editor, event: PointerEvent): void {
  const state = getControlsState(editor)
  if (state.mediaResizing) return
  const clickTarget = event.target as HTMLElement | null
  if (isInsideMediaControlsUI(clickTarget)) return
  const media = findMediaTarget(clickTarget, editor.view.dom)
  if (media === state.activeTarget) return
  hideMediaResizeControls(editor)
}

/** DOM → doc position with a node-type guard; also re-resolves stale drag-end positions. */
export function resolveMediaNodePos(
  view: Editor['view'],
  target: HTMLElement,
  nodeType: string
): number | null {
  try {
    const pos = view.posAtDOM(target, 0)
    const node = view.state.doc.nodeAt(pos)
    if (node?.type.name === nodeType) return pos

    const $pos = view.state.doc.resolve(pos)
    if ($pos.nodeAfter?.type.name === nodeType) return $pos.pos
    if ($pos.nodeBefore?.type.name === nodeType) {
      return $pos.pos - $pos.nodeBefore.nodeSize
    }
  } catch {
    return null
  }
  return null
}

/** Desktop hover or touch click — gripper + toolbar, or toolbar-only for X embeds. */
export function showMediaResizeControls(editor: Editor, target: HTMLElement): boolean {
  const state = getControlsState(editor)
  const nodeType = getMediaNodeType(target)
  if (!nodeType) return false

  const nodePos = resolveMediaNodePos(editor.view, target, nodeType)
  if (nodePos === null) return false

  const gripper = findGripperForMedia(target, editor.view.dom)
  const toolbarOnly = nodeType === 'x'
  if (!gripper && !toolbarOnly) return false

  if (state.activeTarget && state.activeTarget !== target) {
    hideMediaResizeControls(editor)
  }

  cancelHoverHide(state)

  if (gripper) activateResizeGripper(gripper, target)
  openMediaToolbar({
    target,
    editor,
    nodeType,
    nodePos
  })

  state.activeTarget = target
  state.activeNodePos = nodePos
  setPointerTracking(editor, state, true)
  setOutsideListeners(state, true)
  return true
}

export function lockMediaSelection(editor: Editor): void {
  getControlsState(editor).selectionLocked = true
}

export function deleteActiveMediaNode(editor: Editor): boolean {
  const state = getControlsState(editor)
  const { activeTarget, activeNodePos, mediaResizing } = state
  if (!activeTarget || activeNodePos === null || mediaResizing || !editor.isEditable) {
    return false
  }

  const node = editor.state.doc.nodeAt(activeNodePos)
  const nodeType = getMediaNodeType(activeTarget)
  if (!node || !nodeType || node.type.name !== nodeType) return false

  editor.view.dispatch(editor.state.tr.delete(activeNodePos, activeNodePos + node.nodeSize))
  return true
}

export function handleMediaDeleteKey(editor: Editor, event: KeyboardEvent): boolean {
  if (!isDeleteKey(event)) return false
  if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return false
  if (!getControlsState(editor).activeTarget) return false
  if (isFormControlInMediaUI(document.activeElement)) return false
  if (isEditingMediaCaption(document.activeElement)) return false
  // A focused caret in text must keep editing text — hover chrome only owns the
  // key when the node is selected or focus is outside the editor.
  if (editor.view.hasFocus() && editor.state.selection instanceof TextSelection) return false
  if (!deleteActiveMediaNode(editor)) return false

  event.preventDefault()
  return true
}

export function handleMediaHover(editor: Editor, event: MouseEvent, finePointer: boolean): boolean {
  const state = getControlsState(editor)
  if (!canUseHoverChrome(state, finePointer)) return false

  cancelHoverHide(state)
  state.pointerX = event.clientX
  state.pointerY = event.clientY

  const fromTarget = event.target as HTMLElement
  if (isInsideMediaControlsUI(fromTarget)) return false

  const target = findMediaTarget(fromTarget, editor.view.dom)
  if (!target || target === state.activeTarget) return false

  showMediaResizeControls(editor, target)
  return false
}

export function handleMediaUnhover(
  editor: Editor,
  event: MouseEvent,
  finePointer: boolean
): boolean {
  const state = getControlsState(editor)
  if (!canUseHoverChrome(state, finePointer) || !state.activeTarget || state.mediaResizing) {
    return false
  }

  const related = event.relatedTarget as HTMLElement | null
  if (isInsideMediaControlsUI(related)) return false
  if (findMediaTarget(related, editor.view.dom) === state.activeTarget) return false

  scheduleHoverHide(editor, event)
  return false
}

export function handleMediaClick(editor: Editor, event: MouseEvent | TouchEvent): boolean {
  if (isInsideMediaControlsUI(event.target as HTMLElement)) return false

  const target = findMediaTarget(event.target as HTMLElement, editor.view.dom)
  if (!target) return false

  // Notion-style: embed iframes stay interactive; only images use click-to-lock.
  if (isInteractiveEmbed(getMediaNodeType(target))) return false

  lockMediaSelection(editor)
  showMediaResizeControls(editor, target)
  event.preventDefault()
  return true
}

/** Re-mount hover controls after resize rebuilds the gripper decoration. */
export function restoreControlsAfterResize(
  editor: Editor,
  gripper: HTMLElement,
  nodePos?: number
): void {
  setMediaResizing(editor, false)

  let target: HTMLElement | null = null
  if (nodePos !== undefined) {
    target = editor.view.nodeDOM(nodePos) as HTMLElement | null
  } else {
    target = resolveMediaFromGripper(gripper, editor.view.dom)
  }

  hideMediaResizeControls(editor)

  if (hasFinePointer() && target?.matches(':hover')) {
    showMediaResizeControls(editor, target)
  }

  editor.commands.focus()
}
