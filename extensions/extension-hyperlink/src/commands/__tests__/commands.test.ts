/**
 * Unit tests for the hyperlink command façade.
 *
 * Scope: pure factory wiring — engine primitives, canonical/alias
 * mapping, the composed `buildHyperlinkCommands` shape. Editor-level
 * integration (caret behaviour, mark range edits) is covered by the
 * Cypress e2e suite; spinning a full Tiptap editor inside Bun would
 * pull jsdom into a unit-test layer that is intentionally headless.
 */
import { describe, expect, it, mock } from 'bun:test'

import { PREVENT_AUTOLINK_META } from '../../constants'
import { createURLDecisions } from '../../url-decisions'
import { createHyperlinkEngine } from '../engine'
import { canonicalCommands } from '../families'
import { buildHyperlinkCommands } from '../index'

const MARK = 'hyperlink'

/** Minimal CommandProps double — only the surface our engine touches. */
function mockProps(
  overrides: {
    setMarkResult?: boolean
    unsetMarkResult?: boolean
    isActive?: boolean
    dispatch?: boolean
  } = {}
) {
  const setMark = mock(() => overrides.setMarkResult ?? true)
  const unsetMark = mock(() => overrides.unsetMarkResult ?? true)
  const setMeta = mock(() => undefined)
  const isActive = mock(() => overrides.isActive ?? false)
  const dispatch = overrides.dispatch === false ? undefined : mock(() => undefined)
  return {
    props: {
      commands: { setMark, unsetMark } as never,
      tr: { setMeta } as never,
      dispatch: dispatch as never,
      editor: { isActive } as never,
      state: {} as never,
      view: {} as never,
      chain: (() => ({})) as never,
      can: (() => ({})) as never
    },
    spies: { setMark, unsetMark, setMeta, isActive }
  }
}

describe('createHyperlinkEngine', () => {
  const urls = createURLDecisions()
  const engine = createHyperlinkEngine({ markName: MARK, urls })

  describe('set', () => {
    it('writes the mark with the URL-Decisions-canonicalized href', () => {
      const { props, spies } = mockProps()
      const ok = engine.set({ href: 'example.com' })(props)
      expect(ok).toBe(true)
      // Bare domain → defaultProtocol-prefixed before being written.
      expect(spies.setMark).toHaveBeenCalledWith(
        MARK,
        expect.objectContaining({
          href: 'https://example.com'
        })
      )
    })

    it('forwards extra attributes alongside href', () => {
      const { props, spies } = mockProps()
      engine.set({ href: 'https://x.test', target: '_blank', title: 't' })(props)
      expect(spies.setMark).toHaveBeenCalledWith(
        MARK,
        expect.objectContaining({
          href: 'https://x.test',
          target: '_blank',
          title: 't'
        })
      )
    })

    it('returns false and skips setMark for empty href', () => {
      const { props, spies } = mockProps()
      const ok = engine.set({ href: '' })(props)
      expect(ok).toBe(false)
      expect(spies.setMark).not.toHaveBeenCalled()
    })

    it('returns false when the URL Decisions gate rejects the href', () => {
      const { props, spies } = mockProps()
      // `javascript:` is permanently blocked by `isSafeHref`, regardless
      // of any caller policy — verifies the gate runs at the engine boundary.
      const ok = engine.set({ href: 'javascript:alert(1)' })(props)
      expect(ok).toBe(false)
      expect(spies.setMark).not.toHaveBeenCalled()
    })

    it('flags PREVENT_AUTOLINK on the transaction when dispatched', () => {
      const { props, spies } = mockProps()
      engine.set({ href: 'https://x.test' })(props)
      expect(spies.setMeta).toHaveBeenCalledWith(PREVENT_AUTOLINK_META, true)
    })

    it('does NOT set the meta during a dry-run (dispatch undefined)', () => {
      const { props, spies } = mockProps({ dispatch: false })
      engine.set({ href: 'https://x.test' })(props)
      expect(spies.setMeta).not.toHaveBeenCalled()
    })

    it('does NOT set the meta when setMark returns false', () => {
      const { props, spies } = mockProps({ setMarkResult: false })
      engine.set({ href: 'https://x.test' })(props)
      expect(spies.setMeta).not.toHaveBeenCalled()
    })
  })

  describe('unset', () => {
    it('removes the mark with extendEmptyMarkRange', () => {
      const { props, spies } = mockProps()
      const ok = engine.unset()(props)
      expect(ok).toBe(true)
      expect(spies.unsetMark).toHaveBeenCalledWith(MARK, { extendEmptyMarkRange: true })
    })

    it('flags PREVENT_AUTOLINK on the transaction when dispatched', () => {
      const { props, spies } = mockProps()
      engine.unset()(props)
      expect(spies.setMeta).toHaveBeenCalledWith(PREVENT_AUTOLINK_META, true)
    })

    it('skips the meta during a dry-run', () => {
      const { props, spies } = mockProps({ dispatch: false })
      engine.unset()(props)
      expect(spies.setMeta).not.toHaveBeenCalled()
    })
  })

  describe('toggle', () => {
    it('routes to set when the mark is inactive', () => {
      const { props, spies } = mockProps({ isActive: false })
      engine.toggle({ href: 'https://x.test' })(props)
      expect(spies.setMark).toHaveBeenCalled()
      expect(spies.unsetMark).not.toHaveBeenCalled()
    })

    it('routes to unset when the mark is active', () => {
      const { props, spies } = mockProps({ isActive: true })
      engine.toggle({ href: 'https://x.test' })(props)
      expect(spies.unsetMark).toHaveBeenCalled()
      expect(spies.setMark).not.toHaveBeenCalled()
    })

    it('respects the gate even on toggle (rejects unsafe href when inactive)', () => {
      const { props, spies } = mockProps({ isActive: false })
      const ok = engine.toggle({ href: 'javascript:alert(1)' })(props)
      expect(ok).toBe(false)
      expect(spies.setMark).not.toHaveBeenCalled()
    })
  })
})

describe('canonicalCommands', () => {
  const urls = createURLDecisions()
  const engine = createHyperlinkEngine({ markName: MARK, urls })
  const cmds = canonicalCommands(engine)

  it('aliases setLink → engine.set (same reference, never a stale copy)', () => {
    expect(cmds.setLink).toBe(engine.set)
    expect(cmds.setHyperlink).toBe(engine.set)
  })

  it('aliases unsetLink → engine.unset', () => {
    expect(cmds.unsetLink).toBe(engine.unset)
    expect(cmds.unsetHyperlink).toBe(engine.unset)
  })

  it('aliases toggleLink → engine.toggle', () => {
    expect(cmds.toggleLink).toBe(engine.toggle)
    expect(cmds.toggleHyperlink).toBe(engine.toggle)
  })
})

describe('buildHyperlinkCommands', () => {
  const urls = createURLDecisions()
  const cmds = buildHyperlinkCommands({
    markName: MARK,
    urls,
    options: {
      autolink: true,
      protocols: [],
      openOnClick: true,
      linkOnPaste: true,
      HTMLAttributes: {},
      popovers: { previewHyperlink: null, createHyperlink: null },
      defaultProtocol: 'https',
      enableClickSelection: false,
      exitable: false
    }
  })

  /**
   * Locks the public command surface (`HyperlinkPublicCommands`)
   * against the runtime façade. If a public command is added in
   * `surface.ts` and forgotten in `index.ts`, the `satisfies`
   * clause is the compile-time guard; this list is the runtime
   * smoke that catches accidental tree-shake / build-output drops.
   */
  const expectedKeys = [
    'setHyperlink',
    'unsetHyperlink',
    'toggleHyperlink',
    'openCreateHyperlinkPopover',
    'editHyperlinkText',
    'editHyperlinkHref',
    'editHyperlink',
    'setLink',
    'unsetLink',
    'toggleLink'
  ] as const

  it.each(expectedKeys)('exposes %s as a function factory', (name) => {
    expect(typeof cmds[name]).toBe('function')
  })

  it('does not leak any extra commands beyond the public surface', () => {
    expect(Object.keys(cmds).sort()).toEqual([...expectedKeys].sort())
  })

  it('canonical commands reach the engine — sanity end-to-end', () => {
    const { props, spies } = mockProps()
    cmds.setHyperlink({ href: 'example.com' })(props)
    expect(spies.setMark).toHaveBeenCalledWith(
      MARK,
      expect.objectContaining({
        href: 'https://example.com'
      })
    )
  })
})
