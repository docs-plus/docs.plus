import { describe, expect, test } from 'bun:test'

import { buildSectionTree } from '../../domain/buildSectionTree'
import type { SectionChange } from '../../types'

const entry = (text: string, level: number): SectionChange => ({
  tocId: null,
  text,
  level,
  status: 'unchanged',
  magnitude: null
})

describe('buildSectionTree', () => {
  test('a node owns the following entries of strictly greater level', () => {
    const tree = buildSectionTree([entry('Title', 1), entry('A', 2), entry('A1', 3), entry('B', 2)])
    expect(tree).toHaveLength(1)
    expect(tree[0].children.map((child) => child.text)).toEqual(['A', 'B'])
    expect(tree[0].children[0].children.map((child) => child.text)).toEqual(['A1'])
  })

  test('the preamble is a root sibling that owns no children', () => {
    // At level 0 the nesting rule would make it the parent of the whole outline,
    // and every breadcrumb would then carry a phantom empty ancestor.
    const tree = buildSectionTree([entry('', 0), entry('Title', 1), entry('A', 2)])
    expect(tree.map((node) => node.text)).toEqual(['', 'Title'])
    expect(tree[0].children).toEqual([])
    expect(tree[1].children.map((node) => node.text)).toEqual(['A'])
  })
})
