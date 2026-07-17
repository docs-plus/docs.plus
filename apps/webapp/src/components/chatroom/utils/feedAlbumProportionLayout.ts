import {
  type AlbumCellRect,
  proportionClass,
  roundPx
} from '@components/chatroom/utils/feedAlbumTypes'

function layoutTwoTopBottom(
  ratios: number[],
  maxWidth: number,
  maxHeight: number,
  spacing: number
): AlbumCellRect[] {
  const width = maxWidth
  const height = roundPx(
    Math.min(width / ratios[0]!, width / ratios[1]!, (maxHeight - spacing) / 2)
  )
  return [
    { x: 0, y: 0, width, height },
    { x: 0, y: height + spacing, width, height }
  ]
}

function layoutTwoLeftRightEqual(
  ratios: number[],
  maxWidth: number,
  maxHeight: number,
  spacing: number
): AlbumCellRect[] {
  const width = Math.floor((maxWidth - spacing) / 2)
  const height = roundPx(Math.min(width / ratios[0]!, width / ratios[1]!, maxHeight))
  return [
    { x: 0, y: 0, width, height },
    { x: width + spacing, y: 0, width, height }
  ]
}

function layoutTwoLeftRight(
  ratios: number[],
  maxWidth: number,
  maxHeight: number,
  minWidth: number,
  spacing: number
): AlbumCellRect[] {
  const minimalWidth = roundPx(minWidth * 1.5)
  const secondWidth = Math.min(
    roundPx(
      Math.max(
        0.4 * (maxWidth - spacing),
        (maxWidth - spacing) / ratios[0]! / (1 / ratios[0]! + 1 / ratios[1]!)
      )
    ),
    maxWidth - spacing - minimalWidth
  )
  const firstWidth = maxWidth - secondWidth - spacing
  const height = Math.min(
    maxHeight,
    roundPx(Math.min(firstWidth / ratios[0]!, secondWidth / ratios[1]!))
  )
  return [
    { x: 0, y: 0, width: firstWidth, height },
    { x: firstWidth + spacing, y: 0, width: secondWidth, height }
  ]
}

function layoutTwo(
  ratios: number[],
  proportions: string,
  averageRatio: number,
  maxSizeRatio: number,
  maxWidth: number,
  maxHeight: number,
  minWidth: number,
  spacing: number
): AlbumCellRect[] {
  if (proportions === 'ww' && averageRatio > 1.4 * maxSizeRatio && ratios[1]! - ratios[0]! < 0.2) {
    return layoutTwoTopBottom(ratios, maxWidth, maxHeight, spacing)
  }
  if (proportions === 'ww' || proportions === 'qq') {
    return layoutTwoLeftRightEqual(ratios, maxWidth, maxHeight, spacing)
  }
  return layoutTwoLeftRight(ratios, maxWidth, maxHeight, minWidth, spacing)
}

function layoutThreeLeftAndOther(
  ratios: number[],
  maxWidth: number,
  maxHeight: number,
  minWidth: number,
  spacing: number
): AlbumCellRect[] {
  const firstHeight = maxHeight
  const thirdHeight = roundPx(
    Math.min(
      (maxHeight - spacing) / 2,
      (ratios[1]! * (maxWidth - spacing)) / (ratios[2]! + ratios[1]!)
    )
  )
  const secondHeight = firstHeight - thirdHeight - spacing
  const rightWidth = Math.max(
    minWidth,
    roundPx(
      Math.min(
        (maxWidth - spacing) / 2,
        Math.min(thirdHeight * ratios[2]!, secondHeight * ratios[1]!)
      )
    )
  )
  const leftWidth = Math.min(roundPx(firstHeight * ratios[0]!), maxWidth - spacing - rightWidth)
  return [
    { x: 0, y: 0, width: leftWidth, height: firstHeight },
    { x: leftWidth + spacing, y: 0, width: rightWidth, height: secondHeight },
    { x: leftWidth + spacing, y: secondHeight + spacing, width: rightWidth, height: thirdHeight }
  ]
}

function layoutThreeTopAndOther(
  ratios: number[],
  maxWidth: number,
  maxHeight: number,
  spacing: number
): AlbumCellRect[] {
  const firstWidth = maxWidth
  const firstHeight = roundPx(Math.min(firstWidth / ratios[0]!, (maxHeight - spacing) * 0.66))
  const secondWidth = Math.floor((maxWidth - spacing) / 2)
  const secondHeight = Math.min(
    maxHeight - firstHeight - spacing,
    roundPx(Math.min(secondWidth / ratios[1]!, secondWidth / ratios[2]!))
  )
  const thirdWidth = firstWidth - secondWidth - spacing
  return [
    { x: 0, y: 0, width: firstWidth, height: firstHeight },
    { x: 0, y: firstHeight + spacing, width: secondWidth, height: secondHeight },
    {
      x: secondWidth + spacing,
      y: firstHeight + spacing,
      width: thirdWidth,
      height: secondHeight
    }
  ]
}

function layoutThree(
  ratios: number[],
  proportions: string,
  maxWidth: number,
  maxHeight: number,
  minWidth: number,
  spacing: number
): AlbumCellRect[] {
  if (proportions[0] === 'n') {
    return layoutThreeLeftAndOther(ratios, maxWidth, maxHeight, minWidth, spacing)
  }
  return layoutThreeTopAndOther(ratios, maxWidth, maxHeight, spacing)
}

function layoutFourTopAndOther(
  ratios: number[],
  maxWidth: number,
  maxHeight: number,
  minWidth: number,
  spacing: number
): AlbumCellRect[] {
  const w = maxWidth
  const h0 = roundPx(Math.min(w / ratios[0]!, (maxHeight - spacing) * 0.66))
  const h = roundPx((maxWidth - 2 * spacing) / (ratios[1]! + ratios[2]! + ratios[3]!))
  const w0 = Math.max(minWidth, roundPx(Math.min((maxWidth - 2 * spacing) * 0.4, h * ratios[1]!)))
  const w2 = roundPx(Math.max(Math.max(minWidth, (maxWidth - 2 * spacing) * 0.33), h * ratios[3]!))
  const w1 = w - w0 - w2 - 2 * spacing
  const h1 = Math.min(maxHeight - h0 - spacing, h)
  return [
    { x: 0, y: 0, width: w, height: h0 },
    { x: 0, y: h0 + spacing, width: w0, height: h1 },
    { x: w0 + spacing, y: h0 + spacing, width: w1, height: h1 },
    { x: w0 + spacing + w1 + spacing, y: h0 + spacing, width: w2, height: h1 }
  ]
}

function layoutFourLeftAndOther(
  ratios: number[],
  maxWidth: number,
  maxHeight: number,
  minWidth: number,
  spacing: number
): AlbumCellRect[] {
  const h = maxHeight
  const w0 = roundPx(Math.min(h * ratios[0]!, (maxWidth - spacing) * 0.6))
  const w = roundPx((maxHeight - 2 * spacing) / (1 / ratios[1]! + 1 / ratios[2]! + 1 / ratios[3]!))
  const h0 = roundPx(w / ratios[1]!)
  const h1 = roundPx(w / ratios[2]!)
  const h2 = h - h0 - h1 - 2 * spacing
  const w1 = Math.max(minWidth, Math.min(maxWidth - w0 - spacing, w))
  return [
    { x: 0, y: 0, width: w0, height: h },
    { x: w0 + spacing, y: 0, width: w1, height: h0 },
    { x: w0 + spacing, y: h0 + spacing, width: w1, height: h1 },
    { x: w0 + spacing, y: h0 + h1 + 2 * spacing, width: w1, height: h2 }
  ]
}

function layoutFour(
  ratios: number[],
  proportions: string,
  maxWidth: number,
  maxHeight: number,
  minWidth: number,
  spacing: number
): AlbumCellRect[] {
  if (proportions[0] === 'w') {
    return layoutFourTopAndOther(ratios, maxWidth, maxHeight, minWidth, spacing)
  }
  return layoutFourLeftAndOther(ratios, maxWidth, maxHeight, minWidth, spacing)
}

/** Proportion layouts for 2–4 album tiles (side-by-side / stacked / big+stack). */
export function layoutAlbumByProportion(
  ratios: number[],
  maxWidth: number,
  maxHeight: number,
  minWidth: number,
  spacing: number
): AlbumCellRect[] {
  const count = ratios.length
  const averageRatio = (1 + ratios.reduce((sum, r) => sum + r, 0)) / count
  const maxSizeRatio = maxWidth / maxHeight
  const proportions = ratios.map(proportionClass).join('')
  if (count === 2) {
    return layoutTwo(
      ratios,
      proportions,
      averageRatio,
      maxSizeRatio,
      maxWidth,
      maxHeight,
      minWidth,
      spacing
    )
  }
  if (count === 3) return layoutThree(ratios, proportions, maxWidth, maxHeight, minWidth, spacing)
  return layoutFour(ratios, proportions, maxWidth, maxHeight, minWidth, spacing)
}
