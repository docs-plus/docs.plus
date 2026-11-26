import { describe, expect, test } from 'bun:test'
import * as Y from 'yjs'

import {
  clearPositionMigrations,
  POSITION_MIGRATIONS_PREFIX,
  stripSnapshotMetadata
} from './snapshotMetadata'

const MIGRATION_ROOT = `${POSITION_MIGRATIONS_PREFIX}root:default`
const MIGRATION_ITEM = `${POSITION_MIGRATIONS_PREFIX}item:42:7`

const buildDocWithContent = (clientId: number, paragraphs: string[]): Y.Doc => {
  const doc = new Y.Doc()
  doc.clientID = clientId
  const fragment = doc.getXmlFragment('default')
  const heading = new Y.XmlElement('heading')
  heading.setAttribute('level', '1')
  const headingText = new Y.XmlText()
  headingText.insert(0, 'Document title')
  heading.insert(0, [headingText])
  fragment.insert(0, [heading])

  for (const text of paragraphs) {
    const p = new Y.XmlElement('paragraph')
    const pText = new Y.XmlText()
    pText.insert(0, text)
    p.insert(0, [pText])
    fragment.insert(fragment.length, [p])
  }
  return doc
}

const seedMigrationEntries = (doc: Y.Doc, mapKey: string, count: number, offset = 0): void => {
  const map = doc.getMap<Record<string, unknown>>(mapKey)
  doc.transact(() => {
    for (let i = 0; i < count; i++) {
      const clock = offset + i
      map.set(`${doc.clientID}:${clock}`, {
        version: 1,
        client: doc.clientID,
        clock,
        seen: [[doc.clientID, clock]],
        transfers: [
          {
            source: { client: doc.clientID, clock, length: 5 },
            target: { client: doc.clientID, clock: clock + 1, type: null }
          }
        ]
      })
    }
  })
}

const readVisibleText = (update: Uint8Array): string => {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, update)
    return doc.getXmlFragment('default').toJSON()
  } finally {
    doc.destroy()
  }
}

const countLiveMigrationEntries = (update: Uint8Array): number => {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, update)
    let total = 0
    for (const key of [...doc.share.keys()]) {
      if (key.startsWith(POSITION_MIGRATIONS_PREFIX)) {
        total += doc.getMap(key).size
      }
    }
    return total
  } finally {
    doc.destroy()
  }
}

const stateVectorOf = (update: Uint8Array): Buffer => {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, update)
    return Buffer.from(Y.encodeStateVector(doc))
  } finally {
    doc.destroy()
  }
}

describe('clearPositionMigrations & stripSnapshotMetadata', () => {
  test('(a) clears migration maps after stripSnapshotMetadata while keeping visible text unchanged', () => {
    const doc = buildDocWithContent(1001, ['First paragraph.', 'Second paragraph with edits.'])
    seedMigrationEntries(doc, MIGRATION_ROOT, 5)
    seedMigrationEntries(doc, MIGRATION_ITEM, 3, 100)
    doc.getMap('metadata').set('commitMessage', 'transient label')
    doc.getMap('metadata').set('isDraft', true)

    const raw = Y.encodeStateAsUpdate(doc)
    doc.destroy()

    expect(countLiveMigrationEntries(raw)).toBe(8)
    const beforeText = readVisibleText(raw)

    const stripped = stripSnapshotMetadata(raw)

    expect(countLiveMigrationEntries(stripped)).toBe(0)
    expect(readVisibleText(stripped)).toBe(beforeText)
    expect(stripped.includes(Buffer.from('\x09transfers'))).toBe(false)

    // Verify clearPositionMigrations returns the exact live entry count on a decoded doc.
    const probe = new Y.Doc()
    Y.applyUpdate(probe, raw)
    expect(clearPositionMigrations(probe)).toBe(8)
    expect(clearPositionMigrations(probe)).toBe(0)
    probe.destroy()
  })

  test('(b) preserves state vector byte-equality before and after stripSnapshotMetadata', () => {
    const doc = buildDocWithContent(2002, ['Alpha', 'Beta', 'Gamma'])
    seedMigrationEntries(doc, MIGRATION_ROOT, 12)
    seedMigrationEntries(doc, MIGRATION_ITEM, 4, 50)
    doc.getMap('metadata').set('commitMessage', 'checkpoint')
    doc.getMap('metadata').set('isDraft', false)

    const raw = Y.encodeStateAsUpdate(doc)
    doc.destroy()

    const beforeSv = stateVectorOf(raw)
    const stripped = stripSnapshotMetadata(raw)
    const afterSv = stateVectorOf(stripped)

    expect(afterSv.equals(beforeSv)).toBe(true)
    expect(countLiveMigrationEntries(stripped)).toBe(0)
  })

  test('(c) merging a cleared head with an old head carrying entries leaves 0 live entries after strip', () => {
    const doc = buildDocWithContent(3001, ['Original body line.'])
    seedMigrationEntries(doc, MIGRATION_ROOT, 6)
    const oldHeadWithEntries = Y.encodeStateAsUpdate(doc)

    // A stale client diverges with both a new text edit and a fresh migration entry.
    const staleClient = new Y.Doc()
    staleClient.clientID = 3002
    Y.applyUpdate(staleClient, oldHeadWithEntries)
    const frag = staleClient.getXmlFragment('default')
    const added = new Y.XmlElement('paragraph')
    const addedText = new Y.XmlText()
    addedText.insert(0, 'Stale client edit.')
    added.insert(0, [addedText])
    frag.insert(frag.length, [added])
    seedMigrationEntries(staleClient, MIGRATION_ROOT, 3, 200)
    const staleHeadWithNewEntries = Y.encodeStateAsUpdate(staleClient)
    const expectedText = readVisibleText(staleHeadWithNewEntries)

    const clearedHead = stripSnapshotMetadata(oldHeadWithEntries)
    expect(countLiveMigrationEntries(clearedHead)).toBe(0)

    // Case 1: merge cleared head with the exact older head whose entries were already deleted.
    const mergedOld = Y.mergeUpdates([clearedHead, oldHeadWithEntries])
    const strippedOld = stripSnapshotMetadata(mergedOld)
    expect(countLiveMigrationEntries(strippedOld)).toBe(0)
    expect(readVisibleText(strippedOld)).toBe(readVisibleText(oldHeadWithEntries))

    // Case 2: merge cleared head with a stale client carrying unseen migration entries + a text edit.
    const mergedStale = Y.mergeUpdates([clearedHead, staleHeadWithNewEntries])
    const strippedStale = stripSnapshotMetadata(mergedStale)
    expect(countLiveMigrationEntries(strippedStale)).toBe(0)
    expect(readVisibleText(strippedStale)).toBe(expectedText)

    doc.destroy()
    staleClient.destroy()
  })

  test('(d) leaves a doc without position-migration maps unchanged in text and state vector', () => {
    const doc = buildDocWithContent(4004, ['Clean paragraph one.', 'Clean paragraph two.'])
    const raw = Y.encodeStateAsUpdate(doc)
    const beforeSv = Buffer.from(Y.encodeStateVector(doc))
    const beforeText = doc.getXmlFragment('default').toJSON()

    expect(clearPositionMigrations(doc)).toBe(0)
    doc.destroy()

    const stripped = stripSnapshotMetadata(raw)

    expect(countLiveMigrationEntries(stripped)).toBe(0)
    expect(readVisibleText(stripped)).toBe(beforeText)
    expect(stateVectorOf(stripped).equals(beforeSv)).toBe(true)
  })
})
