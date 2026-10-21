import { describe, expect, test } from 'bun:test'
import type { JSONContent } from '@tiptap/core'

import { checkDiagrams } from '../../domain/checkDiagrams'

const diagram = (source: string): JSONContent[] => [
  { type: 'codeBlock', attrs: { language: 'mermaid' }, content: [{ type: 'text', text: source }] }
]

describe('checkDiagrams', () => {
  test('names the size limit only for a size or edge refusal', async () => {
    const edges = Array.from({ length: 600 }, (_, i) => `a${i} --> b${i}`).join('\n')
    expect(await checkDiagrams(diagram(`flowchart TD\n${edges}`))).toContain('500 edges')
    expect(await checkDiagrams(diagram(`flowchart TD\n${'a --> b\n'.repeat(2500)}`))).toContain(
      '15000 characters'
    )
  })

  test("passes Pele's own reason through for its other fixed limits", async () => {
    // A short source that trips Pele's block-diagram space limit, not size or edges.
    const problem = await checkDiagrams(diagram('block-beta\n  columns 3\n  a space:1000000 b\n'))
    expect(problem).toContain('space blocks')
    expect(problem).not.toContain('15000 characters')
  })
})
