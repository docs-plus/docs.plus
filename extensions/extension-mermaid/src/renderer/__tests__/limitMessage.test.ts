/// <reference types="bun-types" />
// Failure mode: Pele rewords a limit error, and the writer gets the wrong limit,
// a raw count that is one short, or a false reason. Real Pele errors feed the
// classifier, so a wording change upstream fails here.
import { describe, expect, it } from 'bun:test'
import { PeleError, renderAsync } from 'pele/lazy'

import { DEFAULT_LIMITS } from '../../constants'
import type { MermaidLimits } from '../../types'
import { limitMessage } from '../limitMessage'

const edges = (n: number): string =>
  'flowchart LR\n' + Array.from({ length: n }, (_, i) => `a${i}-->a${i + 1}`).join('\n')

async function peleLimit(
  source: string,
  limits: Required<MermaidLimits> = DEFAULT_LIMITS,
  outputLimit = 1000000
): Promise<string> {
  try {
    await renderAsync(source, { limit: limits.characters, maxEdges: limits.edges, outputLimit })
  } catch (err) {
    if (err instanceof PeleError && err.code === 'limit') return err.message
    throw err
  }
  throw new Error('expected a limit error')
}

describe('limitMessage', () => {
  it('names the real character count and the limit', async () => {
    const source = 'flowchart LR\n  A-->B\n%%' + 'x'.repeat(10234 - 23)
    expect(source.length).toBe(10234)
    expect(limitMessage(source, await peleLimit(source), DEFAULT_LIMITS)).toBe(
      'It has 10,234 characters, and the limit is 10,000. Split it into smaller diagrams.'
    )
  })

  it('says more than the edge limit, because Pele stops counting there', async () => {
    const source = edges(251)
    expect(limitMessage(source, await peleLimit(source), DEFAULT_LIMITS)).toBe(
      'It has more than 250 arrows, and the limit is 250. Split it into smaller diagrams.'
    )
  })

  it('explains an output that is too big without a number the writer never typed', async () => {
    const source = edges(50)
    expect(
      limitMessage(source, await peleLimit(source, DEFAULT_LIMITS, 2000), DEFAULT_LIMITS)
    ).toBe('The drawn diagram would be too big for the page. Split it into smaller diagrams.')
  })

  it('follows a host limit, not the default', async () => {
    const source = edges(11)
    const limits = { characters: 10000, edges: 10 }
    expect(limitMessage(source, await peleLimit(source, limits), limits)).toBe(
      'It has more than 10 arrows, and the limit is 10. Split it into smaller diagrams.'
    )
  })

  it("keeps Pele's own reason for a limit that is not size, edges or output", async () => {
    const source = 'block-beta\n  columns 1\n  space:1000000'
    const message = await peleLimit(source)
    expect(message).toMatch(/space blocks/)
    expect(limitMessage(source, message, DEFAULT_LIMITS)).toBe(message)
  })
})
