import { describe, expect, test } from 'bun:test'
import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Y from 'yjs'

import { migrationExtensions } from '../../../../lib/migration-extensions'
import { applyContentToDoc } from '../../domain/applyContentToDoc'
import { liveDocJson } from '../../domain/readContent'
import { findSection } from '../../domain/sections'
import { findUniqueText, jsonTextRuns } from '../../domain/textRuns'
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

const decode = (live: Y.Doc) => liveDocJson(live) as { content: Record<string, any>[] }

const textOf = (live: Y.Doc): string[] =>
  decode(live).content.map((node) =>
    (node.content ?? []).map((child: any) => child.text ?? '').join('')
  )

describe('applyContentToDoc', () => {
  test('replace swaps the whole fragment', () => {
    const live = liveDocWith(
      doc(heading('OLD'), { type: 'paragraph', content: [{ type: 'text', text: 'stale' }] })
    )
    applyContentToDoc(live, scratchFrom(doc(heading('NEW'))), 'replace')

    expect(textOf(live)).toEqual(['NEW'])
  })

  test('append preserves existing content and extends it', () => {
    const live = liveDocWith(doc(heading('Title')))
    applyContentToDoc(
      live,
      scratchFrom(doc({ type: 'paragraph', content: [{ type: 'text', text: 'added' }] })),
      'append'
    )

    expect(textOf(live)).toEqual(['Title', 'added'])
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
    expect(textOf(live)).toEqual(['OLD', 'keep'])
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

describe('findSection', () => {
  test('a body stops at the next heading of any level; the last runs to the end', () => {
    expect(findSection(outline(), 'two')).toMatchObject({
      headingIndex: 2,
      start: 3,
      end: 4,
      level: 2
    })
    expect(findSection(outline(), 'three')).toMatchObject({
      headingIndex: 4,
      start: 5,
      end: 6,
      level: 3
    })
    expect(findSection(outline(), 'missing')).toBeNull()
  })

  test('a subsection edit leaves the parent rev alone; attr key order does not count', () => {
    const revOf = (json: TiptapDocJson, id: string) => findSection(json, id)?.rev
    const edited = outline()
    edited.content[5] = para('changed')
    expect(revOf(edited, 'two')).toBe(revOf(outline(), 'two'))
    expect(revOf(edited, 'three')).not.toBe(revOf(outline(), 'three'))

    const reordered = outline()
    reordered.content[2] = { ...section('Two', 2, 'two'), attrs: { 'toc-id': 'two', level: 2 } }
    expect(revOf(reordered, 'two')).toBe(revOf(outline(), 'two'))
  })
})

describe('applyContentToDoc — blocks mode', () => {
  const revOf = (live: Y.Doc, id: string) => findSection(liveDocJson(live), id)?.rev as string
  // Section `two` owns three body blocks before the next heading.
  const threeBlocks = () =>
    doc(
      section('Title', 1, 'title'),
      section('Two', 2, 'two'),
      para('a'),
      para('b'),
      para('c'),
      section('Next', 2, 'next')
    )
  const at = (live: Y.Doc, from: number, to: number) => ({
    sectionId: 'two',
    rev: revOf(live, 'two'),
    from,
    to
  })

  test('replaces the whole body, keeps the heading, and returns the new rev', () => {
    const live = liveDocWith(outline())
    const before = revOf(live, 'two')
    const result = applyContentToDoc(
      live,
      scratchFrom(doc(para('new two'), section('New three', 3, 'n3'))),
      'blocks',
      { sectionId: 'two', rev: before, from: 0, to: 1 }
    )

    // A block edit renumbers blocks, so it returns no rev and the agent must read again.
    expect(result).toEqual({ ok: true })
    expect(revOf(live, 'two')).not.toBe(before)
    expect(textOf(live)).toEqual([
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

  test('inserts at a caret, replaces one block, and removes one, touching nothing else', () => {
    const live = liveDocWith(threeBlocks())
    applyContentToDoc(live, scratchFrom(doc(para('X'))), 'blocks', at(live, 1, 1))
    expect(textOf(live)).toEqual(['Title', 'Two', 'a', 'X', 'b', 'c', 'Next'])

    applyContentToDoc(live, scratchFrom(doc(para('Y'))), 'blocks', at(live, 2, 3))
    expect(textOf(live)).toEqual(['Title', 'Two', 'a', 'X', 'Y', 'c', 'Next'])

    applyContentToDoc(live, new Y.Doc(), 'blocks', at(live, 1, 2))
    expect(textOf(live)).toEqual(['Title', 'Two', 'a', 'Y', 'c', 'Next'])
  })

  test('refuses a range outside the body, and an edit that changes nothing', () => {
    const live = liveDocWith(threeBlocks())
    const before = textOf(live)

    for (const [from, to] of [
      [2, 1],
      [0, 4]
    ]) {
      expect(
        applyContentToDoc(live, scratchFrom(doc(para('x'))), 'blocks', at(live, from, to))
      ).toMatchObject({ ok: false, status: 'invalid-content' })
    }
    expect(applyContentToDoc(live, new Y.Doc(), 'blocks', at(live, 1, 1))).toMatchObject({
      ok: false,
      status: 'invalid-content'
    })
    expect(textOf(live)).toEqual(before)
  })

  test('a stale rev or a missing heading is a conflict and writes nothing', () => {
    const live = liveDocWith(outline())
    const before = textOf(live)

    expect(
      applyContentToDoc(live, scratchFrom(doc(para('x'))), 'blocks', {
        sectionId: 'two',
        rev: '000000000000',
        from: 0,
        to: 0
      })
    ).toEqual({ ok: false, status: 'conflict', detail: 'section changed' })
    expect(
      applyContentToDoc(live, scratchFrom(doc(para('x'))), 'blocks', {
        sectionId: 'gone',
        rev: '000000000000',
        from: 0,
        to: 0
      })
    ).toEqual({ ok: false, status: 'conflict', detail: 'section not found' })
    expect(textOf(live)).toEqual(before)
  })

  test('a heading at or above the target, or before the end of the body, is refused', () => {
    const live = liveDocWith(threeBlocks())
    const before = textOf(live)

    for (const level of [1, 2]) {
      const result = applyContentToDoc(
        live,
        scratchFrom(doc(section('Sibling', level, `s${level}`))),
        'blocks',
        at(live, 3, 3)
      )
      expect(result).toMatchObject({ ok: false, status: 'invalid-content' })
    }
    // A deeper heading mid-body would pull blocks b and c into a new subsection.
    expect(
      applyContentToDoc(live, scratchFrom(doc(section('Sub', 3, 'sub'))), 'blocks', at(live, 1, 1))
    ).toMatchObject({ ok: false, status: 'invalid-content' })
    expect(textOf(live)).toEqual(before)

    expect(
      applyContentToDoc(live, scratchFrom(doc(section('Sub', 3, 'sub'))), 'blocks', at(live, 3, 3))
    ).toMatchObject({ ok: true })
  })
})

describe('applyContentToDoc — text mode', () => {
  const revOf = (live: Y.Doc, id: string) => findSection(liveDocJson(live), id)?.rev as string
  const withRuns = () =>
    doc(
      section('Title', 1, 'title'),
      section('Budget', 2, 'budget'),
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'The venue budget is ' },
          { type: 'text', marks: [{ type: 'bold' }], text: 'high' },
          { type: 'text', text: ' today' }
        ]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'left' },
          { type: 'hardBreak' },
          { type: 'text', text: 'right' }
        ]
      }
    )
  const edit = (live: Y.Doc, oldText: string, newText: string) =>
    applyContentToDoc(live, new Y.Doc(), 'text', {
      sectionId: 'budget',
      rev: revOf(live, 'budget'),
      oldText,
      newText
    })
  const inline = (live: Y.Doc) => decode(live).content[2].content

  test('replaced text keeps the formatting it replaces, and its neighbours keep theirs', () => {
    const live = liveDocWith(withRuns())
    expect(edit(live, 'high', 'low')).toEqual({ ok: true, rev: revOf(live, 'budget') })
    // An empty `attrs` on a re-inserted mark reads the same to ProseMirror, so compare types.
    const marks = inline(live).map((node: any) => (node.marks ?? []).map((m: any) => m.type))
    expect(inline(live).map((node: any) => node.text)).toEqual([
      'The venue budget is ',
      'low',
      ' today'
    ])
    expect(marks).toEqual([[], ['bold'], []])
  })

  test('inserts at a caret by repeating the nearby words, and deletes with empty text', () => {
    const live = liveDocWith(withRuns())
    edit(live, 'venue budget', 'venue budget of £5,000')
    expect(textOf(live)[2]).toBe('The venue budget of £5,000 is high today')

    edit(live, ' today', '')
    expect(textOf(live)[2]).toBe('The venue budget of £5,000 is high')
  })

  test('repeated context is not rewritten, so a caret insert keeps only the marks on both sides', () => {
    const live = liveDocWith(
      doc(section('Title', 1, 'title'), section('Budget', 2, 'budget'), {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'the venue ' },
          { type: 'text', marks: [{ type: 'bold' }], text: 'budget' },
          { type: 'text', text: ' is set' }
        ]
      })
    )
    const marked = () =>
      inline(live).map((node: any) => [node.text, (node.marks ?? []).map((m: any) => m.type)])

    // After the bold word and before plain text: the insert is plain, and budget stays bold.
    edit(live, 'venue budget', 'venue budget of £5,000')
    expect(marked()).toEqual([
      ['the venue ', []],
      ['budget', ['bold']],
      [' of £5,000 is set', []]
    ])

    // Inside the bold word: the insert is bold.
    edit(live, 'bud', 'buX')
    expect(marked()).toEqual([
      ['the venue ', []],
      ['buXget', ['bold']],
      [' of £5,000 is set', []]
    ])
  })

  test('an emoji swap never splits a surrogate pair', () => {
    // 👍 is D83D DC4D and 👎 is D83D DC4E: they share the high half.
    const live = liveDocWith(
      doc(section('Title', 1, 'title'), section('Budget', 2, 'budget'), para('vote 👍 now'))
    )
    edit(live, 'vote 👍', 'vote 👎')
    expect(textOf(live)[2]).toBe('vote 👎 now')
  })

  test('refuses to remove text that carries a file link, but may add to it', () => {
    const file = {
      type: 'hyperlink',
      attrs: { href: 'https://api.test/plugins/hypermultimedia/d/report.pdf' }
    }
    const live = liveDocWith(
      doc(section('Title', 1, 'title'), section('Budget', 2, 'budget'), {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'See ' },
          { type: 'text', marks: [file], text: 'report.pdf' },
          { type: 'text', text: ' now' }
        ]
      })
    )
    for (const [oldText, newText] of [
      ['See report.pdf', 'See'],
      ['report', 'summary']
    ]) {
      expect(edit(live, oldText, newText)).toMatchObject({ ok: false, status: 'invalid-content' })
    }
    expect(textOf(live)[2]).toBe('See report.pdf now')

    expect(edit(live, 'See report.pdf now', 'See report.pdf today')).toMatchObject({ ok: true })
    expect(textOf(live)[2]).toBe('See report.pdf today')
  })

  test('refuses text that is missing, repeated, across an inline node, or in the heading', () => {
    const live = liveDocWith(withRuns())
    const before = textOf(live)

    for (const oldText of ['absent', 'e', 'leftright', 'Budget']) {
      expect(edit(live, oldText, 'x')).toMatchObject({ ok: false, status: 'invalid-content' })
    }
    expect(edit(live, 'high', 'high')).toMatchObject({ ok: false, status: 'invalid-content' })
    expect(textOf(live)).toEqual(before)
  })

  test('jsonTextRuns splits at inline nodes, so a pre-check match never spans one', () => {
    const body = withRuns().content.slice(2)
    const runs = jsonTextRuns(body)
    expect(findUniqueText(runs, 'high')).toMatchObject({ ok: true })
    expect(findUniqueText(runs, 'e')).toMatchObject({ ok: false })
    expect(findUniqueText(runs, 'leftright')).toEqual({ ok: false, count: 0 })
  })
})
