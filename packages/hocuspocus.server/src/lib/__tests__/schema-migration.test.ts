import { describe, expect, it } from 'bun:test'

import { isOldSchema, transformNestedToFlat } from '../schema-migration'

describe('isOldSchema', () => {
  it('returns true for docs with contentHeading nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, id: 'h1' },
          content: [
            { type: 'contentHeading', content: [{ type: 'text', text: 'Title' }] },
            { type: 'contentWrapper', content: [] }
          ]
        }
      ]
    }
    expect(isOldSchema(doc)).toBe(true)
  })

  it('returns false for flat schema docs', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, 'toc-id': 'abc' },
          content: [{ type: 'text', text: 'Title' }]
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }
      ]
    }
    expect(isOldSchema(doc)).toBe(false)
  })

  it('returns false for empty doc', () => {
    expect(isOldSchema({ type: 'doc' })).toBe(false)
    expect(isOldSchema({ type: 'doc', content: [] })).toBe(false)
  })
})

describe('transformNestedToFlat', () => {
  it('flattens a simple nested heading', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, id: 'title-id' },
          content: [
            {
              type: 'contentHeading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'My Title' }]
            },
            {
              type: 'contentWrapper',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] }]
            }
          ]
        }
      ]
    }

    const result = transformNestedToFlat(doc)

    expect(result.content).toHaveLength(2)
    expect(result.content![0].type).toBe('heading')
    expect(result.content![0].attrs!.level).toBe(1)
    expect(result.content![0].attrs!['toc-id']).toBe('title-id')
    expect(result.content![0].content![0].text).toBe('My Title')
    expect(result.content![1].type).toBe('paragraph')
    expect(result.content![1].content![0].text).toBe('Body text')
  })

  it('flattens deeply nested headings (3 levels)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, id: 'h1' },
          content: [
            {
              type: 'contentHeading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'H1' }]
            },
            {
              type: 'contentWrapper',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'H1 body' }] },
                {
                  type: 'heading',
                  attrs: { level: 2, id: 'h2' },
                  content: [
                    {
                      type: 'contentHeading',
                      attrs: { level: 2 },
                      content: [{ type: 'text', text: 'H2' }]
                    },
                    {
                      type: 'contentWrapper',
                      content: [
                        { type: 'paragraph', content: [{ type: 'text', text: 'H2 body' }] },
                        {
                          type: 'heading',
                          attrs: { level: 3, id: 'h3' },
                          content: [
                            {
                              type: 'contentHeading',
                              attrs: { level: 3 },
                              content: [{ type: 'text', text: 'H3' }]
                            },
                            {
                              type: 'contentWrapper',
                              content: [
                                { type: 'paragraph', content: [{ type: 'text', text: 'H3 body' }] }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }

    const result = transformNestedToFlat(doc)

    expect(result.content).toHaveLength(6)
    expect(result.content![0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1, 'toc-id': 'h1' }
    })
    expect(result.content![0].content![0].text).toBe('H1')
    expect(result.content![1]).toMatchObject({ type: 'paragraph' })
    expect(result.content![2]).toMatchObject({
      type: 'heading',
      attrs: { level: 2, 'toc-id': 'h2' }
    })
    expect(result.content![3]).toMatchObject({ type: 'paragraph' })
    expect(result.content![4]).toMatchObject({
      type: 'heading',
      attrs: { level: 3, 'toc-id': 'h3' }
    })
    expect(result.content![5]).toMatchObject({ type: 'paragraph' })
  })

  it('preserves mixed content (lists, code blocks) inside contentWrapper', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, id: 'h1' },
          content: [
            {
              type: 'contentHeading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Title' }]
            },
            {
              type: 'contentWrapper',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }]
                    }
                  ]
                },
                {
                  type: 'codeBlock',
                  attrs: { language: 'js' },
                  content: [{ type: 'text', text: 'const x = 1' }]
                }
              ]
            }
          ]
        }
      ]
    }

    const result = transformNestedToFlat(doc)

    expect(result.content).toHaveLength(4)
    expect(result.content![0].type).toBe('heading')
    expect(result.content![1].type).toBe('paragraph')
    expect(result.content![2].type).toBe('bulletList')
    expect(result.content![3].type).toBe('codeBlock')
    expect(result.content![3].attrs!.language).toBe('js')
  })

  it('handles empty contentWrapper', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, id: 'h1' },
          content: [
            {
              type: 'contentHeading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Title' }]
            },
            { type: 'contentWrapper', content: [] }
          ]
        }
      ]
    }

    const result = transformNestedToFlat(doc)

    expect(result.content).toHaveLength(1)
    expect(result.content![0].type).toBe('heading')
    expect(result.content![0].content![0].text).toBe('Title')
  })

  it('is idempotent — flat docs pass through unchanged', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, 'toc-id': 'abc' },
          content: [{ type: 'text', text: 'Title' }]
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }
      ]
    }

    const result = transformNestedToFlat(doc)
    expect(result).toEqual(doc)
  })

  it('normalizes data-toc-id attr to toc-id', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, 'data-toc-id': 'old-id' },
          content: [
            {
              type: 'contentHeading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Title' }]
            },
            { type: 'contentWrapper', content: [] }
          ]
        }
      ]
    }

    const result = transformNestedToFlat(doc)
    expect(result.content![0].attrs!['toc-id']).toBe('old-id')
    expect(result.content![0].attrs!['data-toc-id']).toBeUndefined()
  })

  it('clamps heading levels 7-10 to 6', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 8, id: 'h8' },
          content: [
            {
              type: 'contentHeading',
              attrs: { level: 8 },
              content: [{ type: 'text', text: 'Deep' }]
            },
            { type: 'contentWrapper', content: [] }
          ]
        }
      ]
    }

    const result = transformNestedToFlat(doc)
    expect(result.content![0].attrs!.level).toBe(6)
  })
})
