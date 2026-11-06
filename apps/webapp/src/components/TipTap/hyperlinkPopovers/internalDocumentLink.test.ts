/// <reference types="jest" />

import type { Editor } from '@tiptap/core'

import { describeInternalDocumentLink, linkDestination } from './internalDocumentLink'

const origin = window.location.origin
const here = '/test'
const destinationOf = (href: string) => linkDestination(href, here)
const atHere = (link: unknown) => ({ kind: 'here', link })

describe('linkDestination in this pad', () => {
  it('reads a heading deep link by id (ignores the breadcrumb h param)', () => {
    expect(destinationOf(`${origin}/test?h=a%3Eb&id=h-setup`)).toEqual(
      atHere({ kind: 'heading', headingId: 'h-setup' })
    )
  })

  it('reads the canonical chat dialect with and without a message', () => {
    expect(destinationOf(`${origin}/test?chatroom=c1&msg_id=m1`)).toEqual(
      atHere({ kind: 'chat', linkId: 'c1', messageId: 'm1' })
    )
    expect(destinationOf(`${origin}/test?chatroom=c1`)).toEqual(
      atHere({ kind: 'chat', linkId: 'c1', messageId: undefined })
    )
  })

  it('translates the legacy act=ch chat dialect', () => {
    expect(destinationOf(`${origin}/test?act=ch&c_id=c2&m_id=m2`)).toEqual(
      atHere({ kind: 'chat', linkId: 'c2', messageId: 'm2' })
    )
  })

  it('reads filter path segments and the and/or mode', () => {
    expect(destinationOf(`${origin}/test/apple`)).toEqual(
      atHere({ kind: 'filter', terms: ['apple'], mode: 'or', href: `${origin}/test/apple` })
    )
    expect(destinationOf(`${origin}/test/apple/carrot?mode=and`)).toEqual(
      atHere({
        kind: 'filter',
        terms: ['apple', 'carrot'],
        mode: 'and',
        href: `${origin}/test/apple/carrot?mode=and`
      })
    )
    expect(destinationOf(`${origin}/test/apple%20pie`)).toEqual(
      atHere({
        kind: 'filter',
        terms: ['apple pie'],
        mode: 'or',
        href: `${origin}/test/apple%20pie`
      })
    )
  })

  it('keeps a filter segment raw when it is not valid percent-encoding', () => {
    expect(destinationOf(`${origin}/test/%E0`)).toEqual(
      atHere({ kind: 'filter', terms: ['%E0'], mode: 'or', href: `${origin}/test/%E0` })
    )
    expect(destinationOf(`${origin}/test/%E0/apple%20pie`)).toMatchObject(
      atHere(expect.objectContaining({ terms: ['%E0', 'apple pie'] }))
    )
  })

  it('reads history hashes, tolerating a missing or invalid version', () => {
    expect(destinationOf(`${origin}/test#history?version=194`)).toEqual(
      atHere({ kind: 'history', version: 194 })
    )
    expect(destinationOf(`${origin}/test#history`)).toEqual(
      atHere({ kind: 'history', version: null })
    )
    expect(destinationOf(`${origin}/test#history?version=foo`)).toEqual(
      atHere({ kind: 'history', version: null })
    )
  })

  it('reads a bare same-document link as the document itself', () => {
    expect(destinationOf(`${origin}/test`)).toEqual(atHere({ kind: 'document' }))
  })

  it('is not here for a different document (exact slug match, not startsWith)', () => {
    expect(destinationOf(`${origin}/other?id=x`).kind).toBe('pad')
    expect(destinationOf(`${origin}/testing?id=x`).kind).toBe('pad')
  })

  it('is not here for external origins and non-http schemes', () => {
    expect(destinationOf(`https://evil.example/test?id=x`).kind).toBe('web')
    expect(destinationOf(`mailto:hi@example.com`).kind).toBe('other')
  })

  it('is not here for an unparseable href', () => {
    expect(destinationOf('http://').kind).toBe('other')
  })
})

// Only `editor.state.doc.content` is read, so a plain object stands in for a real editor.
const editorWithHeadings = (headings: Array<{ id: string; text: string }>): Editor => {
  const children = headings.map(({ id, text }) => ({
    type: { name: 'heading' },
    attrs: { 'toc-id': id },
    textContent: text
  }))
  const content = { childCount: children.length, child: (i: number) => children[i] }
  return { state: { doc: { content } } } as unknown as Editor
}

describe('describeInternalDocumentLink', () => {
  it('names a filter by its kind, lists every term in the spoken name, and carries the mode', () => {
    const d = describeInternalDocumentLink(
      { kind: 'filter', terms: ['design', 'launch', 'mobile'], mode: 'and', href: '' },
      null
    )
    expect(d).toMatchObject({
      label: 'Filtered view',
      sublabel: 'In this document',
      modeLabel: 'Match all',
      accessibleName: 'Go to filtered view: design, launch, mobile. Match all.'
    })
    const any = describeInternalDocumentLink(
      { kind: 'filter', terms: ['a'], mode: 'or', href: '' },
      null
    )
    expect(any.modeLabel).toBe('Match any')
  })

  it('leads a chat link with the quoted heading name and says Chat or Message below', () => {
    const editor = editorWithHeadings([{ id: 'c1', text: 'Launch plan' }])
    expect(describeInternalDocumentLink({ kind: 'chat', linkId: 'c1' }, editor)).toMatchObject({
      label: '\u201CLaunch plan\u201D',
      sublabel: 'In this document \u00B7 Chat'
    })
    expect(
      describeInternalDocumentLink({ kind: 'chat', linkId: 'c1', messageId: 'm1' }, editor)
    ).toMatchObject({ sublabel: 'In this document \u00B7 Message' })
  })

  it('falls back to Chat when the heading cannot be resolved', () => {
    const editor = editorWithHeadings([{ id: 'other', text: 'Other' }])
    expect(describeInternalDocumentLink({ kind: 'chat', linkId: 'c1' }, editor)).toMatchObject({
      label: 'Chat',
      sublabel: 'In this document'
    })
    expect(describeInternalDocumentLink({ kind: 'chat', linkId: 'c1' }, null)).toMatchObject({
      label: 'Chat',
      sublabel: 'In this document'
    })
  })
})

describe('linkDestination', () => {
  it('puts this pad first, then another pad, then the web', () => {
    const kind = (href: string) => linkDestination(href, '/pad-a').kind

    expect(kind('/pad-a')).toBe('here')
    expect(kind(`${window.location.origin}/pad-a?id=h1`)).toBe('here')
    // This pad wins over the file rule: the dotted segment is a filter term.
    expect(kind('/pad-a/notes.md')).toBe('here')
    expect(kind(`${window.location.origin}/other-pad`)).toBe('pad')
    expect(kind('/other-pad')).toBe('pad')
    expect(kind('https://docs.plus/other-pad')).toBe('web')
    expect(kind(`${window.location.origin}/privacy`)).toBe('web')
    expect(kind(`${window.location.origin}/badges/x.svg`)).toBe('web')
    expect(kind('mailto:a@b.com')).toBe('other')
    expect(kind('/')).toBe('other')
    expect(kind('http://[bad')).toBe('other')
  })

  it('names same-origin /new a new pad, and no other reserved slug or host', () => {
    const kind = (href: string) => linkDestination(href, '/pad-a').kind

    expect(kind('/new')).toBe('newPad')
    expect(kind(`${window.location.origin}/new`)).toBe('newPad')
    expect(kind('/new/')).toBe('newPad')
    expect(kind('/new?x')).toBe('newPad')
    expect(kind('/new#h')).toBe('newPad')
    expect(kind('https://other.host/new')).toBe('web')
    expect(kind('/new/extra')).toBe('other')
    expect(kind('/privacy')).toBe('other')
  })
})
