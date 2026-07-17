import { computeVisualMediaLayout, type VisualMediaLayout } from './chatMediaVisualLayout'

const MAX_W = 400
const MAX_H = 360
const opts = { maxWidth: MAX_W, maxHeight: MAX_H }
const GAP = 2

const landscape = { width: 1600, height: 900 } // ratio 1.78 → 'w'
const tall = { width: 900, height: 1600 } // ratio 0.56 → 'n'
const square = { width: 1000, height: 1000 } // ratio 1 → 'q'
const panorama = { width: 3000, height: 1000 } // ratio 3 → row packer

function fill<T>(n: number, value: T): T[] {
  return Array.from({ length: n }, () => value)
}

/** Every album rect stays inside the reported container box (±1px scale rounding). */
function expectRectsWithin(layout: VisualMediaLayout, maxHeight: number) {
  expect(layout.mode).toBe('mosaic')
  if (layout.mode !== 'mosaic') return
  expect(layout.containerHeight).toBeLessThanOrEqual(maxHeight)
  expect(layout.containerWidth).toBeLessThanOrEqual(MAX_W)
  for (const cell of layout.cells) {
    expect(cell.x).toBeGreaterThanOrEqual(0)
    expect(cell.y).toBeGreaterThanOrEqual(0)
    expect(cell.width).toBeGreaterThan(0)
    expect(cell.height).toBeGreaterThan(0)
    expect(cell.x + cell.width).toBeLessThanOrEqual(layout.containerWidth + 1)
    expect(cell.y + cell.height).toBeLessThanOrEqual(layout.containerHeight + 1)
  }
}

describe('computeVisualMediaLayout', () => {
  it('scales a single 16:9 into 400×225', () => {
    const layout = computeVisualMediaLayout([{ width: 1920, height: 1080 }], opts)
    expect(layout.mode).toBe('single')
    expect(layout.cells).toHaveLength(1)
    expect(layout.cells[0]).toEqual({ width: 400, height: 225 })
    expect(layout.containerWidth).toBe(400)
    expect(layout.containerHeight).toBe(225)
  })

  it('clamps a tall 9:16 single to max height 360', () => {
    const layout = computeVisualMediaLayout([{ width: 1080, height: 1920 }], opts)
    expect(layout.mode).toBe('single')
    expect(layout.containerHeight).toBe(360)
    expect(layout.cells[0]!.height).toBe(360)
    expect(layout.cells[0]!.width).toBe(Math.round(360 * (9 / 16)))
  })

  it('stacks two similar wide photos top/bottom', () => {
    const layout = computeVisualMediaLayout([landscape, landscape], opts)
    expect(layout.mode).toBe('mosaic')
    if (layout.mode !== 'mosaic') return
    expect(layout.cells).toEqual([
      { x: 0, y: 0, width: 400, height: 179 },
      { x: 0, y: 179 + GAP, width: 400, height: 179 }
    ])
    expect(layout.containerWidth).toBe(400)
    expect(layout.containerHeight).toBe(360)
  })

  it('places two square photos side by side, equal halves', () => {
    const layout = computeVisualMediaLayout([square, square], opts)
    expect(layout.mode).toBe('mosaic')
    if (layout.mode !== 'mosaic') return
    expect(layout.cells).toEqual([
      { x: 0, y: 0, width: 199, height: 199 },
      { x: 199 + GAP, y: 0, width: 199, height: 199 }
    ])
    expect(layout.containerWidth).toBe(400)
    expect(layout.containerHeight).toBe(199)
  })

  it('places two tall photos side by side (no more vertical stack mode)', () => {
    const layout = computeVisualMediaLayout([tall, tall], opts)
    expect(layout.mode).toBe('mosaic')
    if (layout.mode !== 'mosaic') return
    expect(layout.cells).toHaveLength(2)
    // Same row, second offset by first width + gap.
    expect(layout.cells[0]!.y).toBe(0)
    expect(layout.cells[1]!.y).toBe(0)
    expect(layout.cells[1]!.x).toBe(layout.cells[0]!.width + GAP)
    expect(layout.cells[0]!.height).toBe(layout.cells[1]!.height)
    expectRectsWithin(layout, MAX_H)
  })

  it('gives mixed landscape+tall an unequal left/right split (landscape wider)', () => {
    const layout = computeVisualMediaLayout([landscape, tall], opts)
    expect(layout.mode).toBe('mosaic')
    if (layout.mode !== 'mosaic') return
    expect(layout.cells).toHaveLength(2)
    expect(layout.cells[0]!.y).toBe(0)
    expect(layout.cells[1]!.y).toBe(0)
    expect(layout.cells[1]!.x).toBe(layout.cells[0]!.width + GAP)
    expect(layout.cells[0]!.width).toBeGreaterThan(layout.cells[1]!.width)
    expectRectsWithin(layout, MAX_H)
  })

  it('lays out three tall photos as big-left + two stacked right', () => {
    const layout = computeVisualMediaLayout([tall, tall, tall], opts)
    expect(layout.mode).toBe('mosaic')
    if (layout.mode !== 'mosaic') return
    expect(layout.cells).toHaveLength(3)
    // Big left spans full height; right column stacks.
    expect(layout.cells[0]!.x).toBe(0)
    expect(layout.cells[0]!.y).toBe(0)
    expect(layout.cells[0]!.height).toBe(360)
    expect(layout.cells[1]!.x).toBe(layout.cells[2]!.x)
    expect(layout.cells[1]!.x).toBeGreaterThan(layout.cells[0]!.width)
    expect(layout.cells[1]!.y).toBe(0)
    expect(layout.cells[2]!.y).toBeGreaterThan(layout.cells[1]!.y)
    // Tall triplet does not force the full column width.
    expect(layout.containerWidth).toBeLessThan(MAX_W)
    expectRectsWithin(layout, MAX_H)
  })

  it('lays out three wide photos as big-top + two below', () => {
    const layout = computeVisualMediaLayout([landscape, landscape, landscape], opts)
    expect(layout.mode).toBe('mosaic')
    if (layout.mode !== 'mosaic') return
    expect(layout.cells).toHaveLength(3)
    expect(layout.cells[0]!.x).toBe(0)
    expect(layout.cells[0]!.y).toBe(0)
    expect(layout.cells[0]!.width).toBe(400)
    // Bottom pair shares a row below the hero.
    expect(layout.cells[1]!.y).toBe(layout.cells[2]!.y)
    expect(layout.cells[1]!.y).toBeGreaterThan(layout.cells[0]!.height)
    expect(layout.cells[2]!.x).toBeGreaterThan(layout.cells[1]!.x)
    expectRectsWithin(layout, MAX_H)
  })

  it('treats unknown dims as 16:9 placeholders (mosaic, never single/stack)', () => {
    const layout = computeVisualMediaLayout([null, null], opts)
    expect(layout.mode).toBe('mosaic')
    expect(layout.cells).toHaveLength(2)
    expectRectsWithin(layout, MAX_H)
  })

  it('mosaics five tall photos via the row packer (not a stack)', () => {
    const layout = computeVisualMediaLayout(fill(5, tall), opts)
    expect(layout.mode).toBe('mosaic')
    if (layout.mode !== 'mosaic') return
    expect(layout.cells).toHaveLength(5)
    // Two rows: first is shorter (non-decreasing row lengths).
    expect(layout.cells[0]!.y).toBe(layout.cells[1]!.y)
    expect(layout.cells[2]!.y).toBe(layout.cells[3]!.y)
    expect(layout.cells[3]!.y).toBe(layout.cells[4]!.y)
    expect(layout.cells[2]!.y).toBeGreaterThan(layout.cells[0]!.y)
    expectRectsWithin(layout, MAX_H)
  })

  it('mosaics six wide photos, every tile visible under the height cap', () => {
    const layout = computeVisualMediaLayout(fill(6, landscape), opts)
    expect(layout.mode).toBe('mosaic')
    expect(layout.cells).toHaveLength(6)
    expectRectsWithin(layout, MAX_H)
  })

  it('mosaics ten photos (attachment cap) within the height cap', () => {
    const layout = computeVisualMediaLayout(fill(10, landscape), opts)
    expect(layout.mode).toBe('mosaic')
    expect(layout.cells).toHaveLength(10)
    expectRectsWithin(layout, MAX_H)
  })

  it('routes a panorama pair (ratio > 2) through the row packer as stacked rows', () => {
    const layout = computeVisualMediaLayout([panorama, panorama], opts)
    expect(layout.mode).toBe('mosaic')
    if (layout.mode !== 'mosaic') return
    expect(layout.cells).toEqual([
      { x: 0, y: 0, width: 400, height: 145 },
      { x: 0, y: 145 + GAP, width: 400, height: 145 }
    ])
    expect(layout.containerWidth).toBe(400)
    expect(layout.containerHeight).toBe(292)
  })

  it('uniformly scales a tall row-packed album down to a small height cap', () => {
    const layout = computeVisualMediaLayout(fill(6, landscape), { maxWidth: MAX_W, maxHeight: 120 })
    expect(layout.mode).toBe('mosaic')
    expect(layout.cells).toHaveLength(6)
    expectRectsWithin(layout, 120)
  })

  it('returns an empty single layout for no visuals', () => {
    const layout = computeVisualMediaLayout([], opts)
    expect(layout.mode).toBe('single')
    expect(layout.cells).toHaveLength(0)
  })
})
