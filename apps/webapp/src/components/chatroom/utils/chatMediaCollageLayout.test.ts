import { getChatMediaCollageLayout } from './chatMediaCollageLayout'

describe('getChatMediaCollageLayout', () => {
  it('returns one placement per visible image for counts 1 through 4', () => {
    for (let count = 1; count <= 4; count++) {
      const layout = getChatMediaCollageLayout(count)
      expect(layout.placements).toHaveLength(count)
    }
  })

  it('clamps layouts above four to the four-up mosaic', () => {
    expect(getChatMediaCollageLayout(9).placements).toHaveLength(4)
    expect(getChatMediaCollageLayout(9).templateAreas).toBe('"a b" "c d"')
  })

  it('uses a fixed collage height for multi-image grids', () => {
    expect(getChatMediaCollageLayout(1).heightPx).toBeNull()
    expect(getChatMediaCollageLayout(3).heightPx).toBeGreaterThan(0)
  })

  it('uses the tall-left layout for three images', () => {
    const layout = getChatMediaCollageLayout(3)
    expect(layout.placements.map((p) => p.area)).toEqual(['a', 'b', 'c'])
    expect(layout.templateAreas).toContain('"a b"')
    expect(layout.templateAreas).toContain('"a c"')
  })
})
