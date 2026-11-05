import { planRail, railLayout, type RailItem } from './planRail'

// `'a:2'` is an open H2 with id `a`; a trailing `-` (`'a:2-'`) marks it folded.
const outline = (...specs: string[]): RailItem[] =>
  specs.map((spec) => {
    const [id, rest] = spec.split(':')
    return { id, level: Number.parseInt(rest, 10), open: !rest.endsWith('-') }
  })

const ids = (items: RailItem[]) => items.map((item) => item.id).join(' ')

describe('planRail fit', () => {
  it('hides the descendants of a folded heading', () => {
    const items = outline('t:1', 'a:2-', 'a1:3', 'a2:4', 'b:2', 'b1:3')
    expect(ids(planRail(items).fit(Infinity, null))).toBe('t a b b1')
  })

  it('returns the folded list itself when every tick fits', () => {
    const plan = planRail(outline('t:1', 'a:2', 'b:2'))
    expect(plan.fit(3, null)).toBe(plan.fit(10, 'a'))
  })

  it('drops the deepest level first until the shallow levels fit', () => {
    const items = outline('t:1', 'a:2', 'a1:3', 'a2:3', 'b:2', 'b1:3', 'b2:3')
    // Budget 3: H3 goes, then three H1/H2 ticks fit exactly.
    expect(ids(planRail(items).fit(3, null))).toBe('t a b')
  })

  it('keeps H1 even when H1 alone is over budget', () => {
    const items = outline('a:1', 'b:1', 'c:1', 'c1:2')
    expect(ids(planRail(items).fit(2, null))).toBe('a b c')
  })

  it('fills leftover slots with deeper ticks after the spy section first', () => {
    const items = outline('t:1', 'a:2', 'a1:3', 'a2:3', 'b:2', 'b1:3', 'b2:3')
    // Budget 5: t a b kept, 2 slots left. Spy in b, so b1 b2 win over a1 a2.
    expect(ids(planRail(items).fit(5, 'b1'))).toBe('t a b b1 b2')
  })

  it('wraps the fill to the top of the outline when the spy section runs out', () => {
    const items = outline('t:1', 'a:2', 'a1:3', 'a2:3', 'b:2', 'b1:3')
    // Spy section b has one deeper tick; the second slot wraps to a1.
    expect(ids(planRail(items).fit(5, 'b'))).toBe('t a a1 b b1')
  })

  it('fills from the top when there is no spy', () => {
    const items = outline('t:1', 'a:2', 'a1:3', 'a2:3', 'b:2', 'b1:3')
    expect(ids(planRail(items).fit(4, null))).toBe('t a a1 b')
  })
})

describe('planRail tickFor', () => {
  const items = outline('t:1', 'a:2-', 'a1:3', 'a2:4', 'b:2')
  const plan = planRail(items)
  const visible = plan.fit(Infinity, null)

  it('maps a hidden heading to its nearest visible ancestor', () => {
    expect(plan.tickFor(visible, 'a2')).toBe('a')
  })

  it('returns null for an unknown or missing id', () => {
    expect(plan.tickFor(visible, 'zz')).toBeNull()
    expect(plan.tickFor(visible, null)).toBeNull()
  })
})

describe('railLayout', () => {
  it('centers a short stack in the live rail', () => {
    expect(railLayout({ count: 5, scrollTop: 0, height: 100 }).stackOffset).toBe(30)
  })

  it('does not offset a stack taller than the rail', () => {
    expect(railLayout({ count: 50, scrollTop: 0, height: 100 }).stackOffset).toBe(0)
  })
})
