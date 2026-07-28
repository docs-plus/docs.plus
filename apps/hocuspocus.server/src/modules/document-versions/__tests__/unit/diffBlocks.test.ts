import { describe, expect, test } from 'bun:test'
import { TiptapTransformer } from '@hocuspocus/transformer'
import { getSchema } from '@tiptap/core'
import * as Y from 'yjs'

import { migrationExtensions } from '../../../../lib/migration-extensions'
import { ydocToPmJson } from '../../../../lib/nested-flat-migration'
import { collectBlockClientIds } from '../../domain/blockAuthors'
import { canonicalizeBlock } from '../../domain/canonicalizeBlock'
import { diffBlocks } from '../../domain/diffBlocks'
import { matchBlocks } from '../../domain/matchBlocks'
import { DIFF_PREVIEW_CHARS, MAX_DIFF_CHANGES, type VersionSnapshot } from '../../types'

const schema = getSchema(migrationExtensions)

const snapshot = (version: number, content: Record<string, unknown>[]): VersionSnapshot => ({
  version,
  data: Y.encodeStateAsUpdate(
    TiptapTransformer.toYdoc({ type: 'doc', content }, 'default', migrationExtensions)
  )
})

const paragraph = (text: string, attrs?: Record<string, unknown>) => ({
  type: 'paragraph',
  ...(attrs ? { attrs } : {}),
  content: [{ type: 'text', text }]
})

const heading = (text: string, tocId: string | null) => ({
  type: 'heading',
  attrs: { level: 1, 'toc-id': tocId },
  content: [{ type: 'text', text }]
})

const linkedParagraph = (tocId: string) => ({
  type: 'paragraph',
  content: [
    {
      type: 'text',
      text: 'docs',
      marks: [{ type: 'hyperlink', attrs: { href: 'https://docs.plus', 'toc-id': tocId } }]
    }
  ]
})

const diffOf = (before: VersionSnapshot | null, after: VersionSnapshot) => {
  const result = diffBlocks(before, after)
  if (!result.ok) throw result.error
  return result.diff
}

/** Y XML built by hand: the transformer mints one clientID per document, and
 *  these cases turn on which of two clients touched which item. */
const asClient = (
  clientId: number,
  mutate: (fragment: Y.XmlFragment) => void,
  base?: Uint8Array
): Uint8Array => {
  const ydoc = new Y.Doc()
  ydoc.clientID = clientId
  if (base) Y.applyUpdate(ydoc, base)
  mutate(ydoc.getXmlFragment('default'))
  return Y.encodeStateAsUpdate(ydoc)
}

const pmDocOf = (bytes: Uint8Array) => {
  const decoded = ydocToPmJson(bytes)
  if (!decoded.ok) throw decoded.error
  return schema.nodeFromJSON(decoded.json)
}

describe('canonicalizeBlock', () => {
  test('strips toc-id and null attrs at every depth', () => {
    expect(canonicalizeBlock(heading('Title', 'abc'))).toEqual(
      canonicalizeBlock(heading('Title', 'xyz'))
    )
    expect(canonicalizeBlock(linkedParagraph('one'))).toEqual(
      canonicalizeBlock(linkedParagraph('two'))
    )
    expect(canonicalizeBlock({ type: 'paragraph', attrs: { paragraphStyle: null } })).toEqual({
      type: 'paragraph'
    })
  })

  test('keeps attrs that are not volatile and is order-insensitive', () => {
    expect(canonicalizeBlock({ attrs: { level: 1, start: 3 } })).toEqual(
      canonicalizeBlock({ attrs: { start: 3, level: 1 } })
    )
    expect(canonicalizeBlock(heading('Title', null))).not.toEqual(
      canonicalizeBlock({ ...heading('Title', null), attrs: { level: 2, 'toc-id': null } })
    )
  })
})

describe('diffBlocks', () => {
  test('reports nothing when only toc-id churned', () => {
    const diff = diffOf(
      snapshot(1, [heading('Title', 'a1'), linkedParagraph('a2')]),
      snapshot(2, [heading('Title', 'b1'), linkedParagraph('b2')])
    )

    expect(diff.changes).toEqual([])
    expect(diff.totalChanges).toBe(0)
    expect(diff.blocksBefore).toBe(2)
    expect(diff.blocksAfter).toBe(2)
    expect(diff.coarse).toBe(false)
    expect(diff.unattributed).toBe(false)
  })

  test('an edited paragraph is one change carrying both previews', () => {
    const diff = diffOf(
      snapshot(4, [paragraph('first'), paragraph('second'), paragraph('third')]),
      snapshot(5, [paragraph('first'), paragraph('second edited'), paragraph('third')])
    )

    expect(diff.totalChanges).toBe(1)
    expect(diff.changes[0]).toMatchObject({
      kind: 'changed',
      index: 1,
      nodeType: 'paragraph',
      before: 'second',
      after: 'second edited'
    })
    expect(diff.fromVersion).toBe(4)
    expect(diff.toVersion).toBe(5)
  })

  test('a paragraph replaced by a heading stays two events', () => {
    const diff = diffOf(
      snapshot(1, [paragraph('intro'), paragraph('body')]),
      snapshot(2, [paragraph('intro'), heading('body', null)])
    )

    expect(diff.totalChanges).toBe(2)
    expect(diff.changes.map((change) => change.kind).sort()).toEqual(['added', 'removed'])
    expect(diff.changes.find((change) => change.kind === 'added')?.nodeType).toBe('heading')
    expect(diff.changes.find((change) => change.kind === 'removed')?.nodeType).toBe('paragraph')
  })

  test('a removed block reports the older index and no positions', () => {
    const diff = diffOf(
      snapshot(1, [paragraph('one'), paragraph('two'), paragraph('three')]),
      snapshot(2, [paragraph('one'), paragraph('three')])
    )

    expect(diff.changes).toHaveLength(1)
    expect(diff.changes[0]).toMatchObject({ kind: 'removed', index: 1, before: 'two' })
    expect(diff.changes[0].from).toBeUndefined()
    expect(diff.changes[0].to).toBeUndefined()
    expect(diff.changes[0].clientIds).toEqual([])
  })

  test('an insertion does not mark every following block as changed', () => {
    const tail = Array.from({ length: 20 }, (_, index) => paragraph(`tail ${index}`))
    const diff = diffOf(
      snapshot(1, [paragraph('head'), ...tail]),
      snapshot(2, [paragraph('head'), paragraph('inserted'), ...tail])
    )

    expect(diff.totalChanges).toBe(1)
    expect(diff.changes[0]).toMatchObject({ kind: 'added', index: 1, after: 'inserted' })
  })

  test('an empty paragraph spans two positions and the walk matches content.size', () => {
    const after = snapshot(2, [
      { type: 'paragraph' },
      paragraph('after the empty one'),
      { type: 'paragraph' }
    ])
    const diff = diffOf(null, after)

    expect(diff.fromVersion).toBe(0)
    expect(diff.blocksBefore).toBe(0)
    expect(diff.totalChanges).toBe(3)
    expect(diff.changes.every((change) => change.kind === 'added')).toBe(true)
    expect(diff.changes[0]).toMatchObject({ from: 0, to: 2 })
    expect(diff.changes[2]).toMatchObject({ from: 23, to: 25 })

    const doc = pmDocOf(after.data)
    let sum = 0
    doc.forEach((child) => {
      sum += child.nodeSize
    })
    expect(sum).toBe(doc.content.size)
    expect(sum).toBe(25)
  })

  test('clips the list but still reports the true total', () => {
    const size = MAX_DIFF_CHANGES + 10
    const diff = diffOf(
      snapshot(
        1,
        Array.from({ length: size }, (_, index) => paragraph(`old ${index}`))
      ),
      snapshot(
        2,
        Array.from({ length: size }, (_, index) => paragraph(`new ${index}`))
      )
    )

    expect(diff.totalChanges).toBe(size)
    expect(diff.changes).toHaveLength(MAX_DIFF_CHANGES)
    expect(diff.changes.at(-1)?.index).toBe(MAX_DIFF_CHANGES - 1)
  })

  test('truncates a preview without materialising the whole block', () => {
    const long = 'x'.repeat(DIFF_PREVIEW_CHARS * 4)
    const diff = diffOf(snapshot(1, [paragraph('short')]), snapshot(2, [paragraph(long)]))

    expect(diff.changes[0].after).toHaveLength(DIFF_PREVIEW_CHARS)
  })

  test('fails closed on undecodable bytes', () => {
    const result = diffBlocks(null, { version: 1, data: new Uint8Array([9, 9, 9, 9]) })
    expect(result.ok).toBe(false)
  })
})

describe('matchBlocks', () => {
  const keys = (...hashes: string[]) => hashes.map((hash) => ({ hash, nodeType: 'paragraph' }))

  test('a moved block is one removal and one insertion, whichever way it moved', () => {
    const back = matchBlocks(keys('a', 'b', 'c', 'd'), keys('a', 'c', 'b', 'd'))
    expect(back.matches.filter((match) => match.kind !== 'unchanged')).toEqual([
      { kind: 'removed', a: 1 },
      { kind: 'added', b: 2 }
    ])

    const forward = matchBlocks(keys('a', 'b', 'c', 'd', 'e'), keys('a', 'd', 'b', 'c', 'e'))
    expect(forward.matches.filter((match) => match.kind !== 'unchanged')).toEqual([
      { kind: 'added', b: 1 },
      { kind: 'removed', a: 3 }
    ])
  })

  test('degenerates to remove-all then add-all past the cell budget', () => {
    const side = (tag: string) =>
      Array.from({ length: 2_100 }, (_, index) => ({ hash: `${tag}${index}`, nodeType: 'p' }))
    const { matches, coarse } = matchBlocks(side('old'), side('new'))

    expect(coarse).toBe(true)
    expect(matches).toHaveLength(4_200)
    expect(matches.filter((match) => match.kind === 'changed')).toEqual([])
  })
})

describe('collectBlockClientIds', () => {
  const withTaskItem = (checked: string) => (fragment: Y.XmlFragment) => {
    const list = new Y.XmlElement('taskList')
    const item = new Y.XmlElement('taskItem')
    item.setAttribute('checked', checked)
    const body = new Y.XmlElement('paragraph')
    body.insert(0, [new Y.XmlText('ship it')])
    item.insert(0, [body])
    list.insert(0, [item])
    fragment.insert(0, [list])
  }

  const setNestedAttribute = (key: string, value: string) => (fragment: Y.XmlFragment) => {
    const list = fragment.get(0) as Y.XmlElement
    const item = list.get(0) as Y.XmlElement
    item.setAttribute(key, value)
  }

  test('credits the client that toggled a task checkbox', () => {
    const base = asClient(1001, withTaskItem('false'))
    const toggled = asClient(2002, setNestedAttribute('checked', 'true'), base)

    const clientIds = collectBlockClientIds(toggled, pmDocOf(toggled))
    expect(clientIds).toEqual([[1001, 2002]])
  })

  test('does not credit a client that only rewrote toc-id', () => {
    const base = asClient(1001, withTaskItem('false'))
    const restamped = asClient(2002, setNestedAttribute('toc-id', 'regenerated'), base)

    const clientIds = collectBlockClientIds(restamped, pmDocOf(restamped))
    expect(clientIds).toEqual([[1001]])
  })

  test('refuses to guess when the Y roots do not line up', () => {
    const bytes = asClient(1001, withTaskItem('false'))
    const mismatched = schema.nodeFromJSON({
      type: 'doc',
      content: [paragraph('one'), paragraph('two')]
    })

    expect(collectBlockClientIds(bytes, mismatched)).toBeNull()
  })
})
