import { describe, expect, test } from 'bun:test'

import { segmentSections } from '../../domain/segmentSections'
import { SECTION_TEXT_MAX_CHARS } from '../../types'
import { doc, heading, para, text } from '../fixtures'

describe('segmentSections', () => {
  test('a section owns the nodes up to the next heading of any level', () => {
    const sections = segmentSections(
      doc(
        heading(1, 'Title', 't1'),
        para(text('title body')),
        heading(3, 'Deeper', 'd1'),
        para(text('deeper body'))
      )
    )
    expect(sections.map((section) => section.headingText)).toEqual(['Title', 'Deeper'])
    // A child heading closes the parent's range, so editing the child can never
    // mark the parent modified.
    expect(sections[0].nodes).toHaveLength(1)
    expect(sections[1].nodes).toHaveLength(1)
  })

  test('pre-heading nodes collect into a level-0 preamble', () => {
    const sections = segmentSections(doc(para(text('stray')), heading(1, 'Title', 't1')))
    expect(sections[0].level).toBe(0)
    expect(sections[0].heading).toBeNull()
    expect(sections[1].headingText).toBe('Title')
  })

  test('collapses a newline in heading text, which would forge a line in a plain-text email', () => {
    const sections = segmentSections(doc(heading(1, 'Real\nForged entry', 't1')))
    expect(sections[0].headingText).toBe('Real Forged entry')
  })

  test('strips a control character, which no whitespace rule would catch', () => {
    // Deleting the control-character strip left every other test green, because
    // they all use a newline, and the whitespace rule already handles that.
    const sections = segmentSections(doc(heading(1, 'clean\u0000\u001Btext', 't1')))
    expect(sections[0].headingText).toBe('cleantext')
  })

  test('caps heading text, which also rides a digest email', () => {
    const sections = segmentSections(doc(heading(1, 'word '.repeat(200), 't1')))
    expect(sections[0].headingText.length).toBe(SECTION_TEXT_MAX_CHARS)
  })

  test('sanitises the toc-id, which becomes a link in the digest email', () => {
    // A stranger on a writable public document sets this attribute over WebSocket,
    // and the email builds `?id=${tocId}` into the unescaped plain-text part.
    const forged = {
      ...heading(1, 'Title'),
      attrs: { level: 1, 'toc-id': 'ok\nhttps://evil.example' }
    }
    expect(segmentSections(doc(forged))[0].tocId).toBe('ok https://evil.example')
  })

  test('clamps a stored heading level, which drives tree depth', () => {
    // 20,000 strictly increasing levels build a tree that overflows JSON.stringify.
    const deep = { ...heading(1, 'Title'), attrs: { level: 1e9 } }
    expect(segmentSections(doc(deep))[0].level).toBe(6)
  })
})
