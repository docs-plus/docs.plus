/// <reference types="jest" />

import { applyEdit } from './applyEdit'

const makeChainSpy = () => {
  const calls: Array<{ method: string; args: any[] }> = []
  const chain: any = new Proxy(
    {},
    {
      get: (_t, method: string) =>
        method === 'run'
          ? () => {
              calls.push({ method: 'run', args: [] })
              return true
            }
          : (...args: any[]) => {
              calls.push({ method, args })
              return chain
            }
    }
  )
  return { chain, calls }
}

describe('applyEdit', () => {
  it('selects the hyperlink range at nodePos before editing', () => {
    const { chain, calls } = makeChainSpy()
    const markType = { name: 'hyperlink' }
    const editor: any = {
      chain: () => chain,
      schema: { marks: { hyperlink: markType } },
      state: {
        doc: {
          resolve: (pos: number) => ({
            pos,
            parent: {
              childAfter: () => ({
                offset: 0,
                node: { nodeSize: 4, marks: [{ type: markType }] }
              }),
              childBefore: () => ({
                offset: 0,
                node: { nodeSize: 4, marks: [{ type: markType }] }
              })
            },
            parentOffset: 0,
            start: () => 10
          })
        }
      }
    }

    expect(applyEdit({ editor, nodePos: 10 }, { href: 'https://next.test' })).toBe(true)
    expect(calls.find((c) => c.method === 'setTextSelection')?.args[0]).toEqual({
      from: 10,
      to: 14
    })
    expect(calls.some((c) => c.method === 'editHyperlinkHref')).toBe(true)
  })
})
