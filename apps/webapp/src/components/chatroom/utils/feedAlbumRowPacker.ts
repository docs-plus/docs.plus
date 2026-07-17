import { type AlbumCellRect, clamp, roundPx } from '@components/chatroom/utils/feedAlbumTypes'

/** Soften extreme ratios so rows stay coherent. */
function cropRatios(ratios: number[], averageRatio: number): number[] {
  const maxRatio = 2.75
  const minRatio = 0.6667
  return ratios.map((ratio) =>
    averageRatio > 1.1 ? clamp(ratio, 1, maxRatio) : clamp(ratio, minRatio, 1)
  )
}

type RowSplit = { lineCounts: number[]; heights: number[] }

function rowHeightForSlice(
  ratios: number[],
  offset: number,
  count: number,
  maxWidth: number,
  spacing: number
): number {
  let sum = 0
  for (let i = offset; i < offset + count; i++) sum += ratios[i]!
  return (maxWidth - (count - 1) * spacing) / sum
}

/** Enumerate 2/3/4-row splits (each row ≤ 3, or ≤ 4 for tall middle rows). */
function enumerateRowSplits(
  ratios: number[],
  count: number,
  averageRatio: number,
  maxWidth: number,
  spacing: number
): RowSplit[] {
  const attempts: RowSplit[] = []
  const push = (lineCounts: number[]) => {
    const heights: number[] = []
    let offset = 0
    for (const lineCount of lineCounts) {
      heights.push(rowHeightForSlice(ratios, offset, lineCount, maxWidth, spacing))
      offset += lineCount
    }
    attempts.push({ lineCounts, heights })
  }

  for (let first = 1; first !== count; first++) {
    const second = count - first
    if (first > 3 || second > 3) continue
    push([first, second])
  }
  for (let first = 1; first !== count - 1; first++) {
    for (let second = 1; second !== count - first; second++) {
      const third = count - first - second
      if (first > 3 || second > (averageRatio < 0.85 ? 4 : 3) || third > 3) continue
      push([first, second, third])
    }
  }
  for (let first = 1; first !== count - 1; first++) {
    for (let second = 1; second !== count - first; second++) {
      for (let third = 1; third !== count - first - second; third++) {
        const fourth = count - first - second - third
        if (first > 3 || second > 3 || third > 3 || fourth > 3) continue
        push([first, second, third, fourth])
      }
    }
  }
  return attempts
}

/**
 * Pack ≥5 tiles (or any panorama ratio > 2) into scored row splits.
 * Scoring target is maxWidth×4/3; callers apply the feed height cap afterward.
 */
export function packAlbumRows(
  inputRatios: number[],
  averageRatio: number,
  maxWidth: number,
  spacing: number,
  minWidth: number
): AlbumCellRect[] {
  const ratios = cropRatios(inputRatios, averageRatio)
  const count = ratios.length
  const maxHeight = Math.floor((maxWidth * 4) / 3)
  const attempts = enumerateRowSplits(ratios, count, averageRatio, maxWidth, spacing)

  let optimal: RowSplit | null = null
  let optimalDiff = 0
  for (const attempt of attempts) {
    const { heights, lineCounts } = attempt
    const totalHeight = heights.reduce((sum, h) => sum + h, 0) + spacing * (lineCounts.length - 1)
    const minLineHeight = Math.min(...heights)
    const bad1 = minLineHeight < minWidth ? 1.5 : 1
    let bad2 = 1
    for (let line = 1; line < lineCounts.length; line++) {
      if (lineCounts[line - 1]! > lineCounts[line]!) {
        bad2 = 1.5
        break
      }
    }
    const diff = Math.abs(totalHeight - maxHeight) * bad1 * bad2
    if (!optimal || diff < optimalDiff) {
      optimal = attempt
      optimalDiff = diff
    }
  }

  const cells: AlbumCellRect[] = new Array(count)
  let index = 0
  let y = 0
  for (let row = 0; row < optimal!.lineCounts.length; row++) {
    const colCount = optimal!.lineCounts[row]!
    const lineHeight = optimal!.heights[row]!
    const height = roundPx(lineHeight)
    let x = 0
    for (let col = 0; col < colCount; col++) {
      // Last column absorbs rounding drift so the row fills exactly maxWidth.
      const width = col === colCount - 1 ? maxWidth - x : roundPx(ratios[index]! * lineHeight)
      cells[index] = { x, y, width, height }
      x += width + spacing
      index++
    }
    y += height + spacing
  }
  return cells
}
