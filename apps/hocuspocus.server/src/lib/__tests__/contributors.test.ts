import { describe, expect, test } from 'bun:test'

import { drainContributors, recordContributor } from '../contributors'

const room = () => ({ name: 'doc' })

describe('contributors', () => {
  test('collects distinct ids per document and resets on drain', () => {
    const doc = room()
    recordContributor(doc, { user: { sub: 'alice' } })
    recordContributor(doc, { user: { sub: 'bob' } })
    recordContributor(doc, { user: { sub: 'alice' } })

    expect(drainContributors(doc)).toEqual(['alice', 'bob'])
    expect(drainContributors(doc)).toEqual([])
  })

  test('keeps documents isolated', () => {
    const first = room()
    const second = room()
    recordContributor(first, { user: { sub: 'alice' } })
    recordContributor(second, { user: { sub: 'bob' } })

    expect(drainContributors(first)).toEqual(['alice'])
    expect(drainContributors(second)).toEqual(['bob'])
  })

  test('ignores contexts with no user without throwing', () => {
    const doc = room()
    recordContributor(doc, null)
    recordContributor(doc, undefined)
    recordContributor(doc, {})
    recordContributor(doc, { user: null } as never)
    recordContributor(doc, { user: {} })
    recordContributor(doc, { user: { sub: '' } })
    recordContributor(null, { user: { sub: 'alice' } })

    expect(drainContributors(doc)).toEqual([])
  })
})
