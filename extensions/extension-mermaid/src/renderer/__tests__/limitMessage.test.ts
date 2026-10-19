/// <reference types="bun-types" />
// Failure mode: Pele rewords a limit error, and the writer gets the wrong limit
// or a raw count that is one short. Real Pele errors feed the classifier, so a
// wording change upstream fails here.
import { describe, expect, it } from 'bun:test'
import { PeleError, render } from 'pele'

import { DEFAULT_LIMITS } from '../../constants'
import { limitMessage } from '../limitMessage'

const edges = (n: number): string =>
  'flowchart LR\n' + Array.from({ length: n }, (_, i) => `a${i}-->a${i + 1}`).join('\n')

function peleLimit(source: string, outputLimit = 1000000): string {
  try {
    render(source, {
      limit: DEFAULT_LIMITS.characters,
      maxEdges: DEFAULT_LIMITS.edges,
      outputLimit
    })
  } catch (err) {
    if (err instanceof PeleError && err.code === 'limit') return err.message
    throw err
  }
  throw new Error('expected a limit error')
}

describe('limitMessage', () => {
  it('names the real character count and the limit', () => {
    const source = 'flowchart LR\n  A-->B\n%%' + 'x'.repeat(15234 - 23)
    expect(source.length).toBe(15234)
    expect(limitMessage(source, peleLimit(source), DEFAULT_LIMITS)).toBe(
      'It has 15,234 characters, and the limit is 15,000. Split it into smaller diagrams.'
    )
  })

  it('says more than the edge limit, because Pele stops counting there', () => {
    const source = edges(501)
    expect(limitMessage(source, peleLimit(source), DEFAULT_LIMITS)).toBe(
      'It has more than 500 arrows, and the limit is 500. Split it into smaller diagrams.'
    )
  })

  it('explains an output that is too big without a number the writer never typed', () => {
    const source = edges(50)
    expect(limitMessage(source, peleLimit(source, 2000), DEFAULT_LIMITS)).toBe(
      'The drawn diagram would be too big for the page. Split it into smaller diagrams.'
    )
  })

  it('follows a host limit, not the default', () => {
    const source = edges(11)
    const limits = { characters: 15000, edges: 10 }
    expect(limitMessage(source, 'Edge limit exceeded.', limits)).toBe(
      'It has more than 10 arrows, and the limit is 10. Split it into smaller diagrams.'
    )
  })
})
