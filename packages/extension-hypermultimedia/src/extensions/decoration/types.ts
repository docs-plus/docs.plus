export type Corner = 'topRight' | 'bottomLeft' | 'topLeft' | 'bottomRight'

export interface MediaGripperInfo {
  from: number
  to: number
  nodeSize: number
  childCount: number
  keyId: string
}

export interface ResizeState {
  initialX: number
  initialY: number
  initialWidth: number
  initialHeight: number
  initialTop: number
  initialLeft: number
  aspectRatio?: number
  isShiftPressed: boolean
}

export interface PointerPosition {
  x: number
  y: number
}

export enum ClampType {
  Left = 'media-resize-clamp--left',
  Right = 'media-resize-clamp--right',
  Top = 'media-resize-clamp--top',
  Bottom = 'media-resize-clamp--bottom',
  TopRight = 'media-resize-clamp--top-right',
  TopLeft = 'media-resize-clamp--top-left',
  BottomRight = 'media-resize-clamp--bottom-right',
  BottomLeft = 'media-resize-clamp--bottom-left'
}

export interface ResizeConstraints {
  minWidth: number
  minHeight: number
  maxWidth?: number
  maxHeight?: number
}
