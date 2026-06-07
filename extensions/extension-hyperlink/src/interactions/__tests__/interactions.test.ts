/**
 * Unit tests for the interactions layer — covers the dependency-bag
 * factory (`createLinkContext`), the URLDecisions builder
 * (`buildUrlDecisions`), and the composition (`createInteractions`)
 * that decides which plugins fire based on extension options.
 *
 * Editor-level integration (rule firing, plugin DOM behaviour) is
 * covered by the Cypress e2e suite — the factories below test the
 * wiring contract: the right plugins exist for the right options,
 * the URL Decisions instance is shared, the `LinkContext` carries
 * the right deps.
 */
import type { Editor } from '@tiptap/core'
import type { MarkType } from '@tiptap/pm/model'
import { describe, expect, it } from 'bun:test'

import type { HyperlinkOptions } from '../../hyperlink'
import { buildUrlDecisions, createLinkContext } from '../createLinkContext'
import { createInteractions } from '../index'

const MARK_NAME = 'hyperlink'

const fakeMarkType = { name: MARK_NAME } as unknown as MarkType
const fakeEditor = { extensionStorage: {} } as unknown as Editor

const baseOptions: HyperlinkOptions = {
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

describe('buildUrlDecisions', () => {
  it('threads defaultProtocol into the URL pipeline', () => {
    const urls = buildUrlDecisions({ ...baseOptions, defaultProtocol: 'ftp' })
    const [decision] = urls.forWrite({ kind: 'href', href: 'example.com' })
    expect(decision?.href).toBe('ftp://example.com')
  })

  it('threads the gate composition (isAllowedUri rejects)', () => {
    const urls = buildUrlDecisions({
      ...baseOptions,
      isAllowedUri: (uri) => !uri.includes('forbidden')
    })
    const [decision] = urls.forWrite({ kind: 'href', href: 'https://forbidden.example' })
    expect(decision).toBeUndefined()
  })

  it('threads shouldAutoLink (text/match scopes) without affecting explicit href writes', () => {
    const urls = buildUrlDecisions({
      ...baseOptions,
      shouldAutoLink: () => false
    })
    // shouldAutoLink fires for autolink-driven writes (text + match)…
    const fromText = urls.forWrite({ kind: 'text', text: 'visit https://example.com today' })
    expect(fromText).toEqual([])
    // …but NOT for explicit writes (href) — `setHyperlink` must always work.
    const [explicit] = urls.forWrite({ kind: 'href', href: 'https://example.com' })
    expect(explicit?.href).toBe('https://example.com')
  })

  it('threads validate as a pre-gate veto', () => {
    const urls = buildUrlDecisions({
      ...baseOptions,
      validate: (url) => url.startsWith('https://')
    })
    const [decision] = urls.forWrite({ kind: 'href', href: 'http://example.com' })
    expect(decision).toBeUndefined()
  })
})

describe('createLinkContext', () => {
  it('packages the editor / type / options / urls / validate / previewPopover', () => {
    const previewPopover = () => null
    const validate = () => true
    const ctx = createLinkContext({
      editor: fakeEditor,
      type: fakeMarkType,
      options: {
        ...baseOptions,
        validate,
        popovers: { previewHyperlink: previewPopover, createHyperlink: null }
      }
    })
    expect(ctx.editor).toBe(fakeEditor)
    expect(ctx.type).toBe(fakeMarkType)
    expect(ctx.validate).toBe(validate)
    expect(ctx.previewPopover).toBe(previewPopover)
    expect(ctx.options.defaultProtocol).toBe('https')
  })

  it('defaults previewPopover to null when no factory was configured', () => {
    const ctx = createLinkContext({ editor: fakeEditor, type: fakeMarkType, options: baseOptions })
    expect(ctx.previewPopover).toBeNull()
  })

  it('builds a fresh URLDecisions instance per context — wired with the option set', () => {
    const ctx = createLinkContext({
      editor: fakeEditor,
      type: fakeMarkType,
      options: { ...baseOptions, defaultProtocol: 'http' }
    })
    const [decision] = ctx.urls.forWrite({ kind: 'href', href: 'example.com' })
    expect(decision?.href).toBe('http://example.com')
  })
})

describe('createInteractions', () => {
  it('always returns the markdown link input rule + linkify paste rule', () => {
    const ctx = createLinkContext({ editor: fakeEditor, type: fakeMarkType, options: baseOptions })
    const result = createInteractions(ctx)
    expect(result.inputRules).toHaveLength(1)
    expect(result.pasteRules).toHaveLength(1)
  })

  it('registers all three plugins when every option is enabled', () => {
    const ctx = createLinkContext({ editor: fakeEditor, type: fakeMarkType, options: baseOptions })
    const result = createInteractions(ctx)
    expect(result.plugins).toHaveLength(3)
  })

  it('skips the autolink plugin when autolink is disabled', () => {
    const ctx = createLinkContext({
      editor: fakeEditor,
      type: fakeMarkType,
      options: { ...baseOptions, autolink: false }
    })
    expect(createInteractions(ctx).plugins).toHaveLength(2)
  })

  it('skips the click handler plugin when openOnClick is disabled', () => {
    const ctx = createLinkContext({
      editor: fakeEditor,
      type: fakeMarkType,
      options: { ...baseOptions, openOnClick: false }
    })
    expect(createInteractions(ctx).plugins).toHaveLength(2)
  })

  it('skips the paste handler plugin when linkOnPaste is disabled', () => {
    const ctx = createLinkContext({
      editor: fakeEditor,
      type: fakeMarkType,
      options: { ...baseOptions, linkOnPaste: false }
    })
    expect(createInteractions(ctx).plugins).toHaveLength(2)
  })

  it('returns zero plugins when ALL three options are disabled — input/paste rules still register', () => {
    // Sanity check: a host that disables every plugin still wants the
    // markdown input rule and the linkify paste rule (those are
    // separate configuration knobs, not gated by the same options).
    const ctx = createLinkContext({
      editor: fakeEditor,
      type: fakeMarkType,
      options: {
        ...baseOptions,
        autolink: false,
        openOnClick: false,
        linkOnPaste: false
      }
    })
    const result = createInteractions(ctx)
    expect(result.plugins).toHaveLength(0)
    expect(result.inputRules).toHaveLength(1)
    expect(result.pasteRules).toHaveLength(1)
  })

  it('plugins receive a Plugin instance shape (sanity for Tiptap consumption)', () => {
    const ctx = createLinkContext({ editor: fakeEditor, type: fakeMarkType, options: baseOptions })
    const result = createInteractions(ctx)
    for (const plugin of result.plugins) {
      // ProseMirror's Plugin attaches a `spec` field; checking its
      // presence avoids depending on the internal class identity.
      expect(plugin).toHaveProperty('spec')
    }
  })
})
