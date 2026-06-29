import { getDefaultController } from '@docs.plus/floating-popover'
import { Editor } from '@tiptap/core'

import {
  resolveMediaNodePos,
  restoreControlsAfterResize,
  setMediaResizing
} from '../../utils/media-resize-controls'
import { getMediaNodeType, resolveMediaFromGripper } from '../../utils/media-target'
import { Corner, ResizeConstraints, ResizeState } from './types'
import {
  calculateAspectRatioDimensions,
  clampDimensionsToConstraints,
  getPointerPosition,
  readGripperDimensions,
  resetGripperPosition,
  resolveMediaNodeConstraints,
  setupKeyboardListeners,
  updateNodeDimensions
} from './utils'

// One in-flight drag per editor. The gripper plugin's `view().destroy()` calls
// `abortActiveGripperDrag` so an editor torn down mid-drag drops the window/
// document listeners and pointer capture instead of leaking them. WeakMap keys
// are GC-safe, so a destroyed editor needs no explicit removal.
const activeDragByEditor = new WeakMap<Editor, () => void>()

export function abortActiveGripperDrag(editor: Editor): void {
  activeDragByEditor.get(editor)?.()
}

export interface GripperBox {
  width: number
  height: number
  top: number
  left: number
}

export interface GripperDragContext {
  deltaX: number
  deltaY: number
  state: ResizeState
  clamp: HTMLElement
}

export type ComputeGripperBox = (ctx: GripperDragContext) => GripperBox

function isLeftEdge(clamp: HTMLElement): boolean {
  return (
    clamp.classList.contains('media-resize-clamp--left') ||
    clamp.classList.contains('media-resize-clamp--top-left') ||
    clamp.classList.contains('media-resize-clamp--bottom-left')
  )
}

function isTopEdge(clamp: HTMLElement): boolean {
  return (
    clamp.classList.contains('media-resize-clamp--top') ||
    clamp.classList.contains('media-resize-clamp--top-left') ||
    clamp.classList.contains('media-resize-clamp--top-right')
  )
}

export function clampGripperBox(
  box: GripperBox,
  state: ResizeState,
  clamp: HTMLElement,
  constraints: ResizeConstraints
): GripperBox {
  const clamped = clampDimensionsToConstraints(box.width, box.height, constraints)
  let { top, left } = box

  if (isLeftEdge(clamp)) {
    left = state.initialLeft + (state.initialWidth - clamped.width)
  }
  if (isTopEdge(clamp)) {
    top = state.initialTop + (state.initialHeight - clamped.height)
  }

  return { width: clamped.width, height: clamped.height, top, left }
}

export interface GripperDragConfig {
  clamp: HTMLElement
  gripper: HTMLElement
  editor: Editor
  computeBox: ComputeGripperBox
}

/** Pointer-capture class on the gripper widget during a drag — never mutate node-view DOM. */
export function setGripperDragging(gripper: HTMLElement, dragging: boolean): void {
  gripper.classList.toggle('hypermultimedia__resize-gripper--dragging', dragging)
  document.documentElement.classList.toggle('hypermultimedia--resize-dragging', dragging)
}

/**
 * Keyed-widget DOM reuse keeps this gripper (and its decoration-time positions)
 * alive across edits above the node, so the doc position must be re-resolved
 * from the DOM at drag end — never trusted from `MediaGripperInfo.from`.
 */
function resolveDragTargetPos(editor: Editor, gripper: HTMLElement): number | null {
  const media = resolveMediaFromGripper(gripper, editor.view.dom)
  if (!media) return null
  const nodeType = getMediaNodeType(media)
  if (!nodeType) return null
  return resolveMediaNodePos(editor.view, media, nodeType)
}

/** Wire one clamp's pointer drag onto the shared resize lifecycle; `computeBox` owns the per-handle math. */
export function attachGripperDrag(config: GripperDragConfig): void {
  const { clamp, gripper, editor, computeBox } = config

  function handleStart(event: Event) {
    if (!(event instanceof PointerEvent)) return
    if (event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()

    const pointerId = event.pointerId
    let ended = false
    let pointerMoveActive = false

    setMediaResizing(editor, true)
    setGripperDragging(gripper, true)
    getDefaultController().close()

    try {
      clamp.setPointerCapture(pointerId)
    } catch {
      setGripperDragging(gripper, false)
      setMediaResizing(editor, false)
      return
    }

    const keyboard = setupKeyboardListeners()
    const start = getPointerPosition(event)
    const nodePos = resolveDragTargetPos(editor, gripper)
    const node = nodePos != null ? editor.state.doc.nodeAt(nodePos) : null
    const constraints = resolveMediaNodeConstraints(editor, node)

    const state: ResizeState = {
      initialX: start.x,
      initialY: start.y,
      initialWidth: gripper.offsetWidth,
      initialHeight: gripper.offsetHeight,
      initialTop: gripper.offsetTop,
      initialLeft: gripper.offsetLeft,
      aspectRatio: gripper.offsetWidth / gripper.offsetHeight,
      isShiftPressed: keyboard.isShiftPressed()
    }

    function applyMove(clientX: number, clientY: number) {
      state.isShiftPressed = keyboard.isShiftPressed()
      const raw = computeBox({
        deltaX: clientX - state.initialX,
        deltaY: clientY - state.initialY,
        state,
        clamp
      })
      const box = clampGripperBox(raw, state, clamp, constraints)

      gripper.style.width = `${box.width}px`
      gripper.style.height = `${box.height}px`
      gripper.style.top = `${box.top}px`
      gripper.style.left = `${box.left}px`
    }

    function ensurePointerCapture() {
      if (ended || clamp.hasPointerCapture(pointerId)) return
      try {
        clamp.setPointerCapture(pointerId)
      } catch {
        // window listeners keep the drag alive until pointer/mouse up
      }
    }

    function onPointerMove(ev: PointerEvent) {
      if (ended || ev.pointerId !== pointerId) return
      ev.preventDefault()
      pointerMoveActive = true
      ensurePointerCapture()
      applyMove(ev.clientX, ev.clientY)
    }

    function onMouseMove(ev: MouseEvent) {
      if (ended || pointerMoveActive || (ev.buttons & 1) === 0) return
      ev.preventDefault()
      applyMove(ev.clientX, ev.clientY)
    }

    function finish(ev?: Event) {
      if (ended) return
      if (ev instanceof PointerEvent && ev.pointerId !== pointerId) return
      ended = true

      const { width, height } = readGripperDimensions(gripper)
      resetGripperPosition(gripper, state.initialLeft, state.initialTop)
      const nodePos = resolveDragTargetPos(editor, gripper)

      try {
        if (nodePos !== null) {
          updateNodeDimensions(editor, nodePos, width, height)
        }
      } finally {
        // Listeners and pointer capture must release even when the commit throws.
        teardown()
        setGripperDragging(gripper, false)
        activeDragByEditor.delete(editor)
        restoreControlsAfterResize(editor, gripper, nodePos ?? undefined)
      }
    }

    // Escape drops the preview without committing: restore the gripper box, then re-arm hover chrome.
    function cancel() {
      if (ended) return
      ended = true

      gripper.style.width = `${state.initialWidth}px`
      gripper.style.height = `${state.initialHeight}px`
      resetGripperPosition(gripper, state.initialLeft, state.initialTop)

      teardown()
      setGripperDragging(gripper, false)
      activeDragByEditor.delete(editor)
      restoreControlsAfterResize(editor, gripper)
    }

    function onWindowBlur() {
      finish()
    }

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'Escape') cancel()
    }

    type ListenerBinding = [EventTarget, string, EventListener]

    // Window pointer + mouse fallbacks keep drag alive across iframe overlays and Cypress.
    const bindings: ListenerBinding[] = [
      [clamp, 'pointermove', onPointerMove as EventListener],
      [clamp, 'pointerup', finish],
      [clamp, 'pointercancel', finish],
      [window, 'pointermove', onPointerMove as EventListener],
      [window, 'pointerup', finish],
      [window, 'pointercancel', finish],
      [window, 'mousemove', onMouseMove as EventListener],
      [window, 'mouseup', finish],
      [window, 'blur', onWindowBlur],
      [document, 'keydown', onKeyDown as EventListener]
    ]

    function setDragListeners(active: boolean): void {
      for (const [target, type, listener] of bindings) {
        target[active ? 'addEventListener' : 'removeEventListener'](type, listener)
      }
    }

    function teardown() {
      setDragListeners(false)
      keyboard.cleanup()
      try {
        if (clamp.hasPointerCapture(pointerId)) clamp.releasePointerCapture(pointerId)
      } catch {
        // capture may already be released
      }
    }

    // Editor destroyed mid-drag: release listeners + visual state without
    // touching the now-dead view (finish() dispatches a transaction and would
    // throw). A later stray pointerup hits the `ended` guard and no-ops.
    function abort() {
      if (ended) return
      ended = true
      teardown()
      setGripperDragging(gripper, false)
      setMediaResizing(editor, false)
      activeDragByEditor.delete(editor)
    }

    setDragListeners(true)
    activeDragByEditor.set(editor, abort)
  }

  clamp.addEventListener('pointerdown', handleStart)
}

/** Left/right/top/bottom handles: one axis, no aspect ratio. */
export const computeSideBox: ComputeGripperBox = ({ deltaX, deltaY, state, clamp }) => {
  let width = state.initialWidth
  let height = state.initialHeight
  let top = state.initialTop
  let left = state.initialLeft

  if (clamp.classList.contains('media-resize-clamp--left')) {
    width = state.initialWidth - deltaX
    left = state.initialLeft + deltaX
  } else if (clamp.classList.contains('media-resize-clamp--right')) {
    width = state.initialWidth + deltaX
  } else if (clamp.classList.contains('media-resize-clamp--top')) {
    height = state.initialHeight - deltaY
    top = state.initialTop + deltaY
  } else if (clamp.classList.contains('media-resize-clamp--bottom')) {
    height = state.initialHeight + deltaY
  }

  return { width, height, top, left }
}

/** Corner handles: free resize, or aspect-locked while Shift is held. */
export function computeCornerBox(corner: Corner): ComputeGripperBox {
  return ({ deltaX, deltaY, state }) => {
    let width: number
    let height: number
    let top = state.initialTop
    let left = state.initialLeft

    if (state.isShiftPressed && state.aspectRatio) {
      const dimensions = calculateAspectRatioDimensions(
        deltaX,
        deltaY,
        state.initialWidth,
        state.initialHeight,
        state.aspectRatio,
        corner
      )
      width = dimensions.width
      height = dimensions.height

      switch (corner) {
        case 'topRight':
          top = state.initialTop + (state.initialHeight - height)
          break
        case 'bottomLeft':
          left = state.initialLeft + (state.initialWidth - width)
          break
        case 'topLeft':
          top = state.initialTop + (state.initialHeight - height)
          left = state.initialLeft + (state.initialWidth - width)
          break
        case 'bottomRight':
      }
    } else {
      switch (corner) {
        case 'topRight':
          width = state.initialWidth + deltaX
          height = state.initialHeight - deltaY
          top = state.initialTop + deltaY
          break
        case 'bottomLeft':
          width = state.initialWidth - deltaX
          height = state.initialHeight + deltaY
          left = state.initialLeft + deltaX
          break
        case 'topLeft':
          width = state.initialWidth - deltaX
          height = state.initialHeight - deltaY
          top = state.initialTop + deltaY
          left = state.initialLeft + deltaX
          break
        case 'bottomRight':
          width = state.initialWidth + deltaX
          height = state.initialHeight + deltaY
          break
      }
    }

    return { width, height, top, left }
  }
}
