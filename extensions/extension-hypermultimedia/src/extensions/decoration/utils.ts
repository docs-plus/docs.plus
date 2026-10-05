import { Editor } from '@tiptap/core'

import {
  resolveSoundCloudExtensionOptions,
  resolveSoundCloudLayoutMinHeight
} from '../../nodes/soundcloud/embedOptions'
import { resolveSpotifyLayoutMinHeight } from '../../nodes/spotify/embedOptions'
import { fitDimensionsToBounds, getEditorContentWidth } from '../../utils/fitImageDimensions'
import { PointerPosition, ResizeConstraints } from './types'

const DEFAULT_CONSTRAINTS: ResizeConstraints = {
  minWidth: 160,
  minHeight: 80
}

export function getPointerPosition(e: MouseEvent | TouchEvent | PointerEvent): PointerPosition {
  if (e instanceof PointerEvent) {
    return { x: e.clientX, y: e.clientY }
  }
  if (e.type.startsWith('touch') && 'touches' in e && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const mouseEvent = e as MouseEvent
  return { x: mouseEvent.clientX, y: mouseEvent.clientY }
}

function resolveResizeConstraints(editor: Editor): ResizeConstraints {
  const maxWidth = getEditorContentWidth(editor)
  return {
    ...DEFAULT_CONSTRAINTS,
    ...(maxWidth > 0 ? { maxWidth } : {})
  }
}

export function resolveMediaNodeConstraints(
  editor: Editor,
  node?: { type: { name: string }; attrs: Record<string, unknown> } | null
): ResizeConstraints {
  const base = resolveResizeConstraints(editor)
  if (!node) return base

  if (node.type.name === 'soundcloud') {
    const options = resolveSoundCloudExtensionOptions(editor)
    const minHeight = resolveSoundCloudLayoutMinHeight(node.attrs, options)
    return { ...base, minHeight: Math.max(base.minHeight, minHeight) }
  }

  if (node.type.name === 'spotify') {
    const minHeight = resolveSpotifyLayoutMinHeight(node.attrs)
    return { ...base, minHeight: Math.max(base.minHeight, minHeight) }
  }

  return base
}

// These players have a fixed height, so a ratio lock would make them grow taller as they grow wider.
const FIXED_HEIGHT_PLAYERS = new Set(['audio', 'soundcloud', 'spotify'])

export function keepsCornerAspectRatio(node?: { type: { name: string } } | null): boolean {
  return !!node && !FIXED_HEIGHT_PLAYERS.has(node.type.name)
}

export function clampDimensionsToConstraints(
  width: number,
  height: number,
  constraints: ResizeConstraints,
  lockedRatio: number | null = null
): { width: number; height: number } {
  const bounds = {
    maxWidth: constraints.maxWidth ?? Number.POSITIVE_INFINITY,
    maxHeight: constraints.maxHeight ?? Number.POSITIVE_INFINITY
  }
  // Width alone carries a locked size, so a drag past the opposite corner still
  // lands on the floors. The column fit runs last, so it wins over a floor.
  if (lockedRatio) {
    const lockedWidth = Math.max(width, constraints.minWidth, constraints.minHeight * lockedRatio)
    return fitDimensionsToBounds(lockedWidth, lockedWidth / lockedRatio, bounds)
  }
  const fitted = fitDimensionsToBounds(width, height, bounds)
  return {
    width: Math.max(constraints.minWidth, fitted.width),
    height: Math.max(constraints.minHeight, fitted.height)
  }
}

export function updateNodeDimensions(
  editor: Editor,
  nodePos: number,
  width: number,
  height: number,
  lockedRatio: number | null = null
): void {
  const { state, dispatch } = editor.view
  const { tr } = state

  // A stale position must never throw (nodeAt RangeErrors past doc end) or resize
  // a foreign node. Resizable media nodes are the ones carrying keyId + width attrs.
  if (nodePos < 0 || nodePos > state.doc.content.size) return
  const nodeAtPos = state.doc.nodeAt(nodePos)
  if (!nodeAtPos || !('keyId' in nodeAtPos.attrs) || !('width' in nodeAtPos.attrs)) return

  const clamped = clampDimensionsToConstraints(
    width,
    height,
    resolveMediaNodeConstraints(editor, nodeAtPos),
    lockedRatio
  )
  tr.setNodeMarkup(nodePos, null, {
    ...nodeAtPos.attrs,
    width: clamped.width,
    height: clamped.height
  })

  tr.setMeta('resizeMedia', true)
  tr.setMeta('addToHistory', true)
  dispatch(tr)
}

/** Style pixels are the source of truth: the gripper may be detached/`display:none` post-rebuild. */
export function readGripperDimensions(gripper: HTMLElement): {
  width: number
  height: number
} {
  const fromStyle = (axis: 'width' | 'height') => parseFloat(gripper.style[axis])
  return {
    width: fromStyle('width') || gripper.offsetWidth,
    height: fromStyle('height') || gripper.offsetHeight
  }
}

export function resetGripperPosition(
  gripper: HTMLElement,
  initialLeft: number,
  initialTop: number
): void {
  gripper.style.left = `${initialLeft}px`
  gripper.style.top = `${initialTop}px`
}
