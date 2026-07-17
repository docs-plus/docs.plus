import type { MediaPixelSize } from '@components/chatroom/utils/messageMediaPaths'

/** Absolute tile box inside a feed album mosaic. */
export type AlbumCellRect = {
  x: number
  y: number
  width: number
  height: number
}

export function roundPx(value: number): number {
  return Math.round(value)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function aspectRatio(dim: MediaPixelSize): number {
  return dim.width / dim.height
}

/** Wide / narrow / square-ish class used by small-album proportion layouts. */
export function proportionClass(ratio: number): 'w' | 'n' | 'q' {
  return ratio > 1.2 ? 'w' : ratio < 0.8 ? 'n' : 'q'
}
