import {
  CHAT_MEDIA_MOSAIC_GAP_PX,
  CHAT_MEDIA_PLACEHOLDER_ASPECT
} from '@components/chatroom/utils/feedAlbumLayout'
import { layoutAlbumByProportion } from '@components/chatroom/utils/feedAlbumProportionLayout'
import { packAlbumRows } from '@components/chatroom/utils/feedAlbumRowPacker'
import { type AlbumCellRect, aspectRatio } from '@components/chatroom/utils/feedAlbumTypes'
import {
  CHAT_MEDIA_MAX_ATTACHMENTS,
  type MediaPixelSize,
  positiveMediaDims
} from '@components/chatroom/utils/messageMediaPaths'

type LayoutBox = {
  containerWidth: number
  containerHeight: number
}

export type { AlbumCellRect }

export type VisualMediaLayout =
  | (LayoutBox & {
      mode: 'single'
      cells: MediaPixelSize[]
    })
  | (LayoutBox & {
      mode: 'mosaic'
      cells: AlbumCellRect[]
    })

type LayoutOptions = {
  maxWidth: number
  maxHeight: number
}

/** Smallest album tile edge; keeps mobile mosaics from collapsing to slivers. */
const MOSAIC_MIN_TILE_PX = 40

function placeholderDim(maxWidth: number): MediaPixelSize {
  return { width: maxWidth, height: maxWidth / CHAT_MEDIA_PLACEHOLDER_ASPECT }
}

function resolveDim(dim: MediaPixelSize | null, maxWidth: number): MediaPixelSize {
  return positiveMediaDims(dim?.width, dim?.height) ?? placeholderDim(maxWidth)
}

function scaleToBox(dim: MediaPixelSize, maxWidth: number, maxHeight: number): MediaPixelSize {
  const scale = Math.min(maxWidth / dim.width, maxHeight / dim.height, 1)
  return {
    width: Math.round(dim.width * scale),
    height: Math.round(dim.height * scale)
  }
}

/**
 * Pack 2–10 album tiles into absolute rects: proportion layout for 2–4,
 * row packer for ≥5 or any panorama (ratio > 2). Average ratio seeds with +1
 * so branch selection matches the historical packer.
 */
function packAlbumTiles(
  dims: MediaPixelSize[],
  maxWidth: number,
  feedMaxHeight: number,
  spacing: number,
  minWidth: number
): AlbumCellRect[] {
  const ratios = dims.map(aspectRatio)
  const count = ratios.length
  const averageRatio = (1 + ratios.reduce((sum, r) => sum + r, 0)) / count

  if (count >= 5 || ratios.some((r) => r > 2)) {
    return packAlbumRows(ratios, averageRatio, maxWidth, spacing, minWidth)
  }

  const maxHeight = Math.min(maxWidth, feedMaxHeight)
  return layoutAlbumByProportion(ratios, maxWidth, maxHeight, minWidth, spacing)
}

function emptyLayout(): Extract<VisualMediaLayout, { mode: 'single' }> {
  return {
    mode: 'single',
    cells: [],
    containerWidth: 0,
    containerHeight: 0
  }
}

/** Fit the album under the feed height cap with one uniform scale (preserves shape). */
function finalizeMosaic(
  rects: AlbumCellRect[],
  feedMaxHeight: number
): Extract<VisualMediaLayout, { mode: 'mosaic' }> {
  const rawWidth = Math.max(...rects.map((r) => r.x + r.width))
  const rawHeight = Math.max(...rects.map((r) => r.y + r.height))

  if (rawHeight <= feedMaxHeight) {
    return { mode: 'mosaic', cells: rects, containerWidth: rawWidth, containerHeight: rawHeight }
  }

  const scale = feedMaxHeight / rawHeight
  const cells = rects.map((r) => ({
    x: Math.round(r.x * scale),
    y: Math.round(r.y * scale),
    width: Math.round(r.width * scale),
    height: Math.round(r.height * scale)
  }))
  return {
    mode: 'mosaic',
    cells,
    containerWidth: Math.round(rawWidth * scale),
    containerHeight: feedMaxHeight
  }
}

/**
 * Feed album packing. n=1 clamps into `single`; n≥2 emits absolute mosaic rects
 * (`feedAlbumProportionLayout` for 2–4, `feedAlbumRowPacker` for 5–10 / panorama).
 * Unknown dims resolve to 16:9 placeholders. `maxWidth` must be the feed column
 * width (never the self-measured `w-fit` host) so mobile mosaics fill the bubble.
 */
export function computeVisualMediaLayout(
  dims: Array<MediaPixelSize | null>,
  options: LayoutOptions
): VisualMediaLayout {
  const { maxWidth, maxHeight } = options
  const input = dims.slice(0, CHAT_MEDIA_MAX_ATTACHMENTS)
  if (input.length === 0) return emptyLayout()

  const resolved = input.map((d) => resolveDim(d, maxWidth))

  if (resolved.length === 1) {
    const sized = scaleToBox(resolved[0]!, maxWidth, maxHeight)
    return {
      mode: 'single',
      cells: [sized],
      containerWidth: sized.width,
      containerHeight: sized.height
    }
  }

  const minWidth = Math.max(MOSAIC_MIN_TILE_PX, Math.round(maxWidth / 8))
  const rects = packAlbumTiles(resolved, maxWidth, maxHeight, CHAT_MEDIA_MOSAIC_GAP_PX, minWidth)
  return finalizeMosaic(rects, maxHeight)
}
