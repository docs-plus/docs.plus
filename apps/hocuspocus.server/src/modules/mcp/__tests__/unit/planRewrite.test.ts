import { describe, expect, test } from 'bun:test'
import type { JSONContent } from '@tiptap/core'

import { parseMarkdown } from '../../../document-conversion/domain/markdownImport'
import { planRewrite } from '../../domain/planRewrite'

const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }]
})
const video: JSONContent = { type: 'youtube', attrs: { src: 'https://youtu.be/x' } }
const picture: JSONContent = {
  type: 'paragraph',
  content: [{ type: 'image', attrs: { src: 'p.png' } }]
}

// Blocks 2 and 4 hold media.
const body = [paragraph('one'), video, paragraph('three'), picture]
const plan = (markdown: string) => planRewrite(body, parseMarkdown(markdown).content ?? [])

describe('planRewrite', () => {
  test('keeps each media block at its place and in the order the Markdown names it', () => {
    expect(plan('New intro\n\n[4]\n\nMiddle\n\n[2]\n\nEnd')).toEqual({
      ok: true,
      content: [paragraph('New intro'), paragraph('Middle'), paragraph('End')],
      keep: [
        { block: 3, at: 1 },
        { block: 1, at: 2 }
      ]
    })
    // Two numbers on adjacent lines are one paragraph; each still stands alone on its line.
    expect(plan('[2]\n[4]')).toEqual({
      ok: true,
      content: [],
      keep: [
        { block: 1, at: 0 },
        { block: 3, at: 0 }
      ]
    })
  })

  test('refuses a missing media block, and a number copied with its placeholder', () => {
    for (const markdown of ['Text\n\n[2]', 'Text\n\n[2]\n\n[4] [image]', 'a\n[4]\nb\n\n[2]']) {
      const result = plan(markdown)
      expect(result).toMatchObject({ ok: false })
      expect(!result.ok && result.problem).toContain('block(s) 4 hold a picture, video or file')
    }
  })

  test('refuses a repeated, a non-media and an out-of-range number', () => {
    expect(plan('[2]\n\n[4]\n\n[2]')).toEqual({
      ok: false,
      problem: 'markdown: [2] appears more than once. Name each media block once.'
    })
    expect(plan('[1]\n\n[2]\n\n[4]')).toEqual({
      ok: false,
      problem:
        'markdown: [1] holds no picture, video or file. Write its text in the Markdown instead.'
    })
    for (const number of [0, 5]) {
      expect(plan(`[2]\n\n[4]\n\n[${number}]`)).toEqual({
        ok: false,
        problem: `markdown: [${number}] names no block. This section has 4 block(s).`
      })
    }
  })

  test('refuses media after a new heading, which would leave the section', () => {
    expect(plan('[2]\n\n### Sub\n\n[4]')).toMatchObject({
      ok: false,
      problem: expect.stringContaining('[4] stands after a new heading')
    })
    expect(plan('[2]\n\n[4]\n\n### Sub\n\nText')).toMatchObject({ ok: true })
  })

  test('a section without media takes plain Markdown, and a number inside a list is text', () => {
    expect(planRewrite([paragraph('old')], parseMarkdown('- [1]').content ?? [])).toMatchObject({
      ok: true,
      keep: []
    })
  })
})
