/// <reference types="jest" />

import { applyCreate } from './applyCreate'

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

const baseOpts = (extra?: Partial<any>) => {
  const { chain, calls } = makeChainSpy()
  const schema = {
    text: jest.fn((t: string, marks: any[]) => ({ text: t, marks })),
    marks: {
      hyperlink: { create: jest.fn((attrs: unknown) => ({ type: 'hyperlink', attrs })) }
    }
  }
  const editor: any = {
    isDestroyed: false,
    chain: () => chain,
    can: () => ({ setHyperlink: jest.fn(() => true) }),
    schema,
    state: {
      selection: { empty: false, from: 1, to: 5 },
      doc: {
        content: { size: 10 },
        textBetween: jest.fn(() => 'hello')
      },
      schema
    }
  }
  return {
    opts: {
      extensionName: 'hyperlink',
      attributes: { target: '_blank' },
      validate: undefined,
      ...extra,
      editor: { ...editor, ...extra?.editor, state: { ...editor.state, ...extra?.editor?.state } }
    } as any,
    calls
  }
}

describe('applyCreate', () => {
  it('uses setHyperlink + preventAutolink when no text is provided', () => {
    const { opts, calls } = baseOpts()
    applyCreate(opts, { href: 'https://x.test' })
    expect(calls.some((c) => c.method === 'setHyperlink')).toBe(true)
    expect(
      calls.some(
        (c) => c.method === 'setMeta' && c.args[0] === 'preventAutolink' && c.args[1] === true
      )
    ).toBe(true)
  })

  it('uses insertContent + preventAutolink when text is provided and selection is empty', () => {
    const { opts, calls } = baseOpts({
      editor: {
        state: {
          selection: { empty: true, from: 1, to: 1 },
          doc: { content: { size: 10 }, textBetween: jest.fn(() => '') }
        }
      }
    })
    applyCreate(opts, { href: 'https://x.test', text: 'Picked' })
    expect(calls.some((c) => c.method === 'insertContent')).toBe(true)
    expect(
      calls.some(
        (c) => c.method === 'setMeta' && c.args[0] === 'preventAutolink' && c.args[1] === true
      )
    ).toBe(true)
  })

  it('uses replaceSelectionWith via command + preventAutolink when text is provided and selection is non-empty', () => {
    const { opts, calls } = baseOpts()
    opts.editor.state.selection = { empty: false, from: 1, to: 5 }
    applyCreate(opts, { href: 'https://x.test', text: 'Picked' })
    expect(calls.some((c) => c.method === 'command')).toBe(true)
    expect(
      calls.some(
        (c) => c.method === 'setMeta' && c.args[0] === 'preventAutolink' && c.args[1] === true
      )
    ).toBe(true)
  })

  it('always finishes with chain.run()', () => {
    const { opts, calls } = baseOpts()
    applyCreate(opts, { href: 'https://x.test' })
    expect(calls[calls.length - 1]?.method).toBe('run')
  })

  it('passes the picker-derived href into the mark attrs', () => {
    const { opts, calls } = baseOpts()
    applyCreate(opts, { href: 'https://picked.test' })
    const setHyperlinkCall = calls.find((c) => c.method === 'setHyperlink')
    expect(setHyperlinkCall?.args?.[0]?.href).toBe('https://picked.test')
  })

  it('returns false without writing when the extension gate rejects the href', () => {
    const { opts, calls } = baseOpts({
      editor: {
        can: () => ({ setHyperlink: jest.fn(() => false) }),
        state: {
          selection: { empty: true, from: 1, to: 1 },
          doc: { content: { size: 10 }, textBetween: jest.fn(() => '') }
        }
      }
    })
    expect(applyCreate(opts, { href: 'https://blocked.test', text: 'Blocked' })).toBe(false)
    expect(calls).toHaveLength(0)
  })
})
