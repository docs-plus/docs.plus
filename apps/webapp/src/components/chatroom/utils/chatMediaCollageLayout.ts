/** Telegram / Discord-style grouped media layouts (1–4 visible tiles; 5+ uses 4-up + overflow badge). */

export type CollageCellPlacement = {
  area: string
}

export type ChatMediaCollageLayout = {
  templateAreas: string
  templateColumns: string
  templateRows: string
  heightPx: number | null
  placements: CollageCellPlacement[]
}

const FR = 'minmax(0, 1fr)'
const rowTracks = (count: number) => Array.from({ length: count }, () => FR).join(' ')

const mosaic = (
  templateAreas: string,
  templateColumns: string,
  templateRows: string,
  heightPx: number,
  areas: string[]
): ChatMediaCollageLayout => ({
  templateAreas,
  templateColumns,
  templateRows,
  heightPx,
  placements: areas.map((area) => ({ area }))
})

/** Returns grid template + per-image area for `count` images (1–4). */
export function getChatMediaCollageLayout(count: number): ChatMediaCollageLayout {
  const n = Math.max(1, Math.min(4, count))

  switch (n) {
    case 1:
      return {
        templateAreas: '"a"',
        templateColumns: '1fr',
        templateRows: 'auto',
        heightPx: null,
        placements: [{ area: 'a' }]
      }
    case 2:
      return mosaic('"a b"', '1fr 1fr', rowTracks(1), 200, ['a', 'b'])
    case 3:
      return mosaic('"a b" "a c"', '1fr 1fr', rowTracks(2), 260, ['a', 'b', 'c'])
    case 4:
      return mosaic('"a b" "c d"', '1fr 1fr', rowTracks(2), 260, ['a', 'b', 'c', 'd'])
    default:
      return mosaic('"a b" "c d"', '1fr 1fr', rowTracks(2), 260, ['a', 'b', 'c', 'd'])
  }
}
