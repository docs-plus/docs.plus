import { describe, expect, test } from 'bun:test'
import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Y from 'yjs'

import { migrationExtensions } from '../../../../lib/migration-extensions'
import { applyContentToDoc } from '../../domain/applyContentToDoc'
import { liveDocJson } from '../../domain/readContent'
import { findSectionBody, sectionRev } from '../../domain/sections'
import type { TiptapDocJson } from '../../types'

const doc = (...content: Record<string, unknown>[]): TiptapDocJson => ({ type: 'doc', content })

const heading = (text: string, level = 1): Record<string, unknown> => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }]
})

const scratchFrom = (payload: TiptapDocJson): Y.Doc =>
  TiptapTransformer.toYdoc(payload, 'default', migrationExtensions)

/** A live document seeded through the same encoder the server uses. */
const liveDocWith = (payload: TiptapDocJson): Y.Doc => {
  const live = new Y.Doc()
  Y.applyUpdate(live, Y.encodeStateAsUpdate(scratchFrom(payload)))
  return live
}

const decode = (live: Y.Doc) =>
  TiptapTransformer.fromYdoc(live, 'default') as { content: Record<string, any>[] }

const blockText = (live: Y.Doc): string[] =>
  decode(live).content.map((node) =>
    (node.content ?? []).map((child: any) => child.text ?? '').join('')
  )

describe('applyContentToDoc', () => {
  test('replace swaps the whole fragment', () => {
    const live = liveDocWith(
      doc(heading('OLD'), { type: 'paragraph', content: [{ type: 'text', text: 'stale' }] })
    )
    applyContentToDoc(live, scratchFrom(doc(heading('NEW'))), 'replace')

    expect(blockText(live)).toEqual(['NEW'])
  })

  test('append preserves existing content and extends it', () => {
    const live = liveDocWith(doc(heading('Title')))
    applyContentToDoc(
      live,
      scratchFrom(doc({ type: 'paragraph', content: [{ type: 'text', text: 'added' }] })),
      'append'
    )

    expect(blockText(live)).toEqual(['Title', 'added'])
  })

  test('marks and attrs survive the cross-document clone', () => {
    const live = liveDocWith(doc(heading('Title')))
    applyContentToDoc(
      live,
      scratchFrom(
        doc({
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'B' },
            {
              type: 'text',
              marks: [{ type: 'hyperlink', attrs: { href: 'https://docs.plus' } }],
              text: 'L'
            }
          ]
        })
      ),
      'append'
    )

    const appended = decode(live).content[1]
    expect(appended.content[0].marks[0].type).toBe('bold')
    expect(appended.content[1].marks[0].attrs.href).toBe('https://docs.plus')
  })

  test('clears isDraft and needsInitialization while preserving foreign metadata keys', () => {
    const live = liveDocWith(doc(heading('Title')))
    const metadata = live.getMap('metadata')
    metadata.set('isDraft', true)
    metadata.set('needsInitialization', true)
    metadata.set('commitMessage', 'keep me')
    metadata.set('someOtherKey', 42)

    applyContentToDoc(live, scratchFrom(doc(heading('New'))), 'replace')

    expect(metadata.get('isDraft')).toBe(false)
    expect(metadata.get('needsInitialization')).toBe(false)
    expect(metadata.get('commitMessage')).toBe('keep me')
    expect(metadata.get('someOtherKey')).toBe(42)
  })

  test('emits exactly one update event per apply', () => {
    const live = liveDocWith(doc(heading('Title')))
    let updates = 0
    live.on('update', () => {
      updates += 1
    })

    applyContentToDoc(
      live,
      scratchFrom(
        doc(heading('New'), { type: 'paragraph', content: [{ type: 'text', text: 'body' }] })
      ),
      'replace'
    )

    expect(updates).toBe(1)
  })

  test('a clone that throws leaves the live document untouched and silent', () => {
    const live = liveDocWith(
      doc(heading('OLD'), { type: 'paragraph', content: [{ type: 'text', text: 'keep' }] })
    )
    let updates = 0
    live.on('update', () => {
      updates += 1
    })

    const scratch = scratchFrom(
      doc(heading('NEW'), { type: 'paragraph', content: [{ type: 'text', text: 'lost' }] })
    )
    const second = scratch.getXmlFragment('default').get(1) as { clone: () => unknown }
    second.clone = () => {
      throw new Error('pathological node')
    }

    expect(() => applyContentToDoc(live, scratch, 'replace')).toThrow('pathological node')
    expect(blockText(live)).toEqual(['OLD', 'keep'])
    expect(updates).toBe(0)
  })
})

const section = (text: string, level: number, id: string): Record<string, unknown> => ({
  type: 'heading',
  attrs: { level, 'toc-id': id },
  content: [{ type: 'text', text }]
})

const para = (text: string): Record<string, unknown> => ({
  type: 'paragraph',
  content: [{ type: 'text', text }]
})

// Title, its body, then a level-2 section that owns a level-3 subsection.
const outline = () =>
  doc(
    section('Title', 1, 'title'),
    para('intro'),
    section('Two', 2, 'two'),
    para('two body'),
    section('Three', 3, 'three'),
    para('three body')
  )

describe('findSectionBody and sectionRev', () => {
  test('a body stops at the next heading of any level; the last runs to the end', () => {
    expect(findSectionBody(outline(), 'two')).toEqual({
      headingIndex: 2,
      start: 3,
      end: 4,
      level: 2
    })
    expect(findSectionBody(outline(), 'three')).toEqual({
      headingIndex: 4,
      start: 5,
      end: 6,
      level: 3
    })
    expect(findSectionBody(outline(), 'missing')).toBeNull()
    expect(sectionRev(outline(), 'missing')).toBeNull()
  })

  test('a subsection edit leaves the parent rev alone; attr key order does not count', () => {
    const edited = outline()
    edited.content[5] = para('changed')
    expect(sectionRev(edited, 'two')).toBe(sectionRev(outline(), 'two'))
    expect(sectionRev(edited, 'three')).not.toBe(sectionRev(outline(), 'three'))

    const reordered = outline()
    reordered.content[2] = { ...section('Two', 2, 'two'), attrs: { 'toc-id': 'two', level: 2 } }
    expect(sectionRev(reordered, 'two')).toBe(sectionRev(outline(), 'two'))
  })
})

describe('applyContentToDoc — section mode', () => {
  const revOf = (live: Y.Doc, id: string) => sectionRev(liveDocJson(live), id) as string

  test('replaces only the body and keeps the heading node and its toc-id', () => {
    const live = liveDocWith(outline())
    const result = applyContentToDoc(
      live,
      scratchFrom(doc(para('new two'), section('New three', 3, 'n3'))),
      'section',
      { sectionId: 'two', rev: revOf(live, 'two') }
    )

    expect(result).toEqual({ ok: true })
    expect(blockText(live)).toEqual([
      'Title',
      'intro',
      'Two',
      'new two',
      'New three',
      'Three',
      'three body'
    ])
    expect(decode(live).content[2].attrs['toc-id']).toBe('two')
  })

  test('a stale rev or a missing heading is a conflict and writes nothing', () => {
    const live = liveDocWith(outline())
    const before = blockText(live)

    expect(
      applyContentToDoc(live, scratchFrom(doc(para('x'))), 'section', {
        sectionId: 'two',
        rev: '000000000000'
      })
    ).toEqual({ ok: false, status: 'conflict', detail: 'section changed' })
    expect(
      applyContentToDoc(live, scratchFrom(doc(para('x'))), 'section', {
        sectionId: 'gone',
        rev: '000000000000'
      })
    ).toEqual({ ok: false, status: 'conflict', detail: 'section not found' })
    expect(blockText(live)).toEqual(before)
  })

  test('a heading at or above the target level is refused and writes nothing', () => {
    const live = liveDocWith(outline())
    const before = blockText(live)

    for (const level of [1, 2]) {
      const result = applyContentToDoc(
        live,
        scratchFrom(doc(section('Sibling', level, `s${level}`))),
        'section',
        { sectionId: 'two', rev: revOf(live, 'two') }
      )
      expect(result).toMatchObject({ ok: false, status: 'invalid-content' })
    }
    expect(blockText(live)).toEqual(before)
  })
})
