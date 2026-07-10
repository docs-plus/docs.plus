import { CHAT_MEDIA_VISIBLE_CAP, computeVisualMediaLayout } from './chatMediaVisualLayout'

const MAX_W = 400
const MAX_H = 360
const opts = { maxWidth: MAX_W, maxHeight: MAX_H }

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

  it('uses mosaic for unknown dims (16:9 placeholders are not tall)', () => {
    const layout = computeVisualMediaLayout([null, null], opts)
    expect(layout.mode).toBe('mosaic')
    expect(layout.cells).toHaveLength(2)
    if (layout.mode === 'mosaic') {
      expect(layout.templateAreas).toBe('"a b"')
    }
  })

  it('stacks when every aspect is tall and there is no overflow', () => {
    const layout = computeVisualMediaLayout(
      [
        { width: 900, height: 1600 },
        { width: 900, height: 1600 }
      ],
      opts
    )
    expect(layout.mode).toBe('stack')
    expect(layout.cells).toHaveLength(2)
    expect(layout.containerHeight).toBeGreaterThan(layout.cells[0]!.height)
  })

  it('forces mosaic when tall visuals overflow the visible cap', () => {
    const dims = Array.from({ length: CHAT_MEDIA_VISIBLE_CAP + 1 }, () => ({
      width: 900,
      height: 1600
    }))
    const layout = computeVisualMediaLayout(dims, opts)
    expect(layout.mode).toBe('mosaic')
    expect(layout.cells).toHaveLength(CHAT_MEDIA_VISIBLE_CAP)
    expect(layout.overflowCount).toBe(1)
  })

  it('uses mosaic for mixed landscape and tall', () => {
    const layout = computeVisualMediaLayout(
      [
        { width: 1600, height: 900 },
        { width: 900, height: 1600 }
      ],
      opts
    )
    expect(layout.mode).toBe('mosaic')
  })

  it('shows four cells and overflow 1 for five landscape visuals', () => {
    const dims = Array.from({ length: 5 }, () => ({ width: 1600, height: 900 }))
    const layout = computeVisualMediaLayout(dims, opts)
    expect(layout.mode).toBe('mosaic')
    expect(layout.cells).toHaveLength(4)
    expect(layout.overflowCount).toBe(1)
    if (layout.mode === 'mosaic') {
      expect(layout.templateAreas).toBe('"a b" "c d"')
    }
  })

  it('keeps mosaic container height ≤ maxHeight', () => {
    const layout = computeVisualMediaLayout(
      [
        { width: 2000, height: 800 },
        { width: 2000, height: 800 },
        { width: 2000, height: 800 },
        { width: 2000, height: 800 }
      ],
      { maxWidth: MAX_W, maxHeight: 120 }
    )
    expect(layout.mode).toBe('mosaic')
    expect(layout.containerHeight).toBeLessThanOrEqual(120)
  })

  it('uses the tall-left mosaic template for three items', () => {
    const layout = computeVisualMediaLayout(
      [
        { width: 1600, height: 900 },
        { width: 1600, height: 900 },
        { width: 1600, height: 900 }
      ],
      opts
    )
    expect(layout.mode).toBe('mosaic')
    if (layout.mode === 'mosaic') {
      expect(layout.cells.map((c) => c.area)).toEqual(['a', 'b', 'c'])
      expect(layout.templateAreas).toContain('"a b"')
      expect(layout.templateAreas).toContain('"a c"')
    }
  })
})
