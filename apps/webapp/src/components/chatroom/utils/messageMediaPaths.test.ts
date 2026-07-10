import type { MessageMediaItem } from '@types'

import { messageMediasForInsert, parseMessageMedias } from './messageMediaPaths'

describe('message media dims round-trip', () => {
  it('preserves finite width/height > 0 through insert→parse', () => {
    const input: MessageMediaItem[] = [
      {
        path: 'u/c/a.png',
        url: 'u/c/a.png',
        type: 'image',
        name: 'a.png',
        size: 1200,
        width: 1920,
        height: 1080
      }
    ]

    const inserted = messageMediasForInsert(input)
    expect(inserted[0]).toMatchObject({ width: 1920, height: 1080 })

    const parsed = parseMessageMedias(inserted)
    expect(parsed[0]).toMatchObject({ width: 1920, height: 1080 })
  })

  it('drops zero, negative, and non-finite dims on insert and parse', () => {
    const inserted = messageMediasForInsert([
      { path: 'u/c/a.png', url: 'u/c/a.png', type: 'image', width: 0, height: 100 },
      { path: 'u/c/b.png', url: 'u/c/b.png', type: 'image', width: 100, height: -1 },
      { path: 'u/c/c.png', url: 'u/c/c.png', type: 'image', width: Number.NaN, height: 50 }
    ])
    expect(inserted.every((m) => m.width === undefined && m.height === undefined)).toBe(true)

    const parsed = parseMessageMedias([
      { path: 'u/c/a.png', url: 'u/c/a.png', type: 'image', width: 0, height: 100 },
      { path: 'u/c/b.png', url: 'u/c/b.png', type: 'image', width: 100, height: Infinity },
      { path: 'u/c/c.png', url: 'u/c/c.png', type: 'image', width: '800', height: 600 }
    ])
    expect(parsed.every((m) => m.width === undefined && m.height === undefined)).toBe(true)
  })
})
