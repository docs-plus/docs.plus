import {
  CHAT_MEDIA_MOSAIC_GAP_PX,
  CHAT_MEDIA_PLACEHOLDER_ASPECT,
  CHAT_MEDIA_STACK_GAP_PX,
  CHAT_MEDIA_TALL_ASPECT,
  type MediaPixelSize,
  positiveMediaDims
} from '@components/chatroom/utils/messageMediaPaths'

export type VisualMediaDim = MediaPixelSize | null

/** Max tiles shown in mosaic/stack; remainder is `overflowCount`. */
export const CHAT_MEDIA_VISIBLE_CAP = 4

type LayoutBox = {
  containerWidth: number
  containerHeight: number
  overflowCount: number
}

export type VisualMediaSizedCell = MediaPixelSize

export type VisualMediaMosaicCell = MediaPixelSize & { area: string }

export type VisualMediaLayout =
  | (LayoutBox & {
      mode: 'single'
      cells: VisualMediaSizedCell[]
    })
  | (LayoutBox & {
      mode: 'stack'
      cells: VisualMediaSizedCell[]
    })
  | (LayoutBox & {
      mode: 'mosaic'
      cells: VisualMediaMosaicCell[]
      mosaicGapPx: number
      templateAreas: string
      templateColumns: string
      templateRows: string
    })

type LayoutOptions = {
  maxWidth: number
  maxHeight: number
}

function placeholderDim(maxWidth: number): MediaPixelSize {
  return { width: maxWidth, height: maxWidth / CHAT_MEDIA_PLACEHOLDER_ASPECT }
}

function resolveDim(dim: VisualMediaDim, maxWidth: number): MediaPixelSize {
  return positiveMediaDims(dim?.width, dim?.height) ?? placeholderDim(maxWidth)
}

function aspectOf(dim: MediaPixelSize): number {
  return dim.width / dim.height
}

function scaleToBox(dim: MediaPixelSize, maxWidth: number, maxHeight: number): MediaPixelSize {
  const scale = Math.min(maxWidth / dim.width, maxHeight / dim.height, 1)
  return {
    width: Math.round(dim.width * scale),
    height: Math.round(dim.height * scale)
  }
}

function heightAtWidth(dim: MediaPixelSize, width: number): number {
  return width * (dim.height / dim.width)
}

function mosaicTemplate(count: number): {
  templateAreas: string
  areas: string[]
  columns: number
  rows: number
} {
  switch (count) {
    case 2:
      return { templateAreas: '"a b"', areas: ['a', 'b'], columns: 2, rows: 1 }
    case 3:
      return { templateAreas: '"a b" "a c"', areas: ['a', 'b', 'c'], columns: 2, rows: 2 }
    default:
      return { templateAreas: '"a b" "c d"', areas: ['a', 'b', 'c', 'd'], columns: 2, rows: 2 }
  }
}

/** Cell height from mosaic row track(s); tall-left (count 3) spans both rows. */
function mosaicCellHeight(index: number, count: number, rowHeights: number[], gap: number): number {
  switch (count) {
    case 2:
      return rowHeights[0]!
    case 3:
      if (index === 0) return rowHeights[0]! + gap + rowHeights[1]!
      return rowHeights[index - 1]!
    default:
      return rowHeights[Math.floor(index / 2)]!
  }
}

function mosaicRowHeights(dims: MediaPixelSize[], cellWidth: number, gap: number): number[] {
  const count = dims.length
  switch (count) {
    case 2:
      return [Math.max(heightAtWidth(dims[0]!, cellWidth), heightAtWidth(dims[1]!, cellWidth))]
    case 3: {
      const leftH = heightAtWidth(dims[0]!, cellWidth)
      const right0 = heightAtWidth(dims[1]!, cellWidth)
      const right1 = heightAtWidth(dims[2]!, cellWidth)
      const rightTotal = right0 + gap + right1
      const total = Math.max(leftH, rightTotal)
      const rightScale = right0 + right1 > 0 ? (total - gap) / (right0 + right1) : 1
      return [right0 * rightScale, right1 * rightScale]
    }
    default:
      return [
        Math.max(heightAtWidth(dims[0]!, cellWidth), heightAtWidth(dims[1]!, cellWidth)),
        Math.max(heightAtWidth(dims[2]!, cellWidth), heightAtWidth(dims[3]!, cellWidth))
      ]
  }
}

function computeMosaic(
  dims: MediaPixelSize[],
  maxWidth: number,
  maxHeight: number,
  overflowCount: number
): Extract<VisualMediaLayout, { mode: 'mosaic' }> {
  const count = dims.length
  const { templateAreas, areas, columns, rows } = mosaicTemplate(count)
  const gap = CHAT_MEDIA_MOSAIC_GAP_PX
  const cellWidth = (maxWidth - gap * (columns - 1)) / columns

  let rowHeights = mosaicRowHeights(dims, cellWidth, gap)
  let containerHeight = rowHeights.reduce((sum, h) => sum + h, 0) + gap * (rows - 1)

  if (containerHeight > maxHeight && containerHeight > 0) {
    const scale = maxHeight / containerHeight
    rowHeights = rowHeights.map((h) => h * scale)
    containerHeight = maxHeight
  }

  containerHeight = Math.round(containerHeight)
  const roundedRows = rowHeights.map((h) => Math.round(h))

  return {
    mode: 'mosaic',
    cells: areas.map((area, index) => ({
      width: Math.round(cellWidth),
      height: mosaicCellHeight(index, count, roundedRows, gap),
      area
    })),
    containerWidth: maxWidth,
    containerHeight,
    overflowCount,
    mosaicGapPx: gap,
    templateAreas,
    templateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    templateRows: roundedRows.map((h) => `${h}px`).join(' ')
  }
}

function computeStack(
  dims: MediaPixelSize[],
  maxWidth: number,
  maxHeight: number,
  overflowCount: number
): Extract<VisualMediaLayout, { mode: 'stack' }> {
  const cells = dims.map((dim) => scaleToBox(dim, maxWidth, maxHeight))
  return {
    mode: 'stack',
    cells,
    containerWidth: Math.max(...cells.map((c) => c.width), 0),
    containerHeight:
      cells.reduce((sum, c) => sum + c.height, 0) +
      CHAT_MEDIA_STACK_GAP_PX * Math.max(0, cells.length - 1),
    overflowCount
  }
}

function emptyLayout(): Extract<VisualMediaLayout, { mode: 'single' }> {
  return {
    mode: 'single',
    cells: [],
    containerWidth: 0,
    containerHeight: 0,
    overflowCount: 0
  }
}

/**
 * Discord-style ratio-first layout: single clamp; hybrid mosaic vs all-tall stack.
 * Unknown dims resolve to 16:9 placeholders (never stack). Overflow (≥5) always mosaic.
 */
export function computeVisualMediaLayout(
  dims: VisualMediaDim[],
  options: LayoutOptions
): VisualMediaLayout {
  const { maxWidth, maxHeight } = options
  const total = dims.length
  if (total === 0) return emptyLayout()

  const overflowCount = Math.max(0, total - CHAT_MEDIA_VISIBLE_CAP)
  const visibleDims = dims.slice(0, CHAT_MEDIA_VISIBLE_CAP).map((d) => resolveDim(d, maxWidth))

  if (visibleDims.length === 1) {
    const sized = scaleToBox(visibleDims[0]!, maxWidth, maxHeight)
    return {
      mode: 'single',
      cells: [sized],
      containerWidth: sized.width,
      containerHeight: sized.height,
      overflowCount
    }
  }

  // Placeholders are 16:9 → any null slot already fails allTall. Overflow forces mosaic so +N has a home.
  const allTall =
    overflowCount === 0 && visibleDims.every((dim) => aspectOf(dim) < CHAT_MEDIA_TALL_ASPECT)

  if (allTall) {
    return computeStack(visibleDims, maxWidth, maxHeight, overflowCount)
  }

  return computeMosaic(visibleDims, maxWidth, maxHeight, overflowCount)
}
