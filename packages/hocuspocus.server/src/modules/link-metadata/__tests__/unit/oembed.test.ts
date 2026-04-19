import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

import { runOembed } from '../../domain/stages/oembed'

describe('runOembed', () => {
  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test('returns null for hosts without an oEmbed provider', async () => {
    const result = await runOembed('https://random-blog.example.com/post')
    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('youtube: fetches provider, normalizes to MetadataResponse', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'video',
          provider_name: 'YouTube',
          provider_url: 'https://www.youtube.com/',
          title: 'Test Video',
          author_name: 'Channel',
          author_url: 'https://www.youtube.com/channel/x',
          thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
          html: '<iframe src="..."></iframe>',
          width: 480,
          height: 270
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    const result = await runOembed('https://www.youtube.com/watch?v=abc')

    expect(result).not.toBeNull()
    expect(result!.title).toBe('Test Video')
    expect(result!.publisher).toEqual({ name: 'YouTube', url: 'https://www.youtube.com/' })
    expect(result!.author).toEqual({ name: 'Channel', url: 'https://www.youtube.com/channel/x' })
    expect(result!.image).toEqual({ url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' })
    expect(result!.oembed).toEqual({
      type: 'video',
      provider: 'YouTube',
      width: 480,
      height: 270,
      thumbnail: 'https://i.ytimg.com/vi/abc/hqdefault.jpg'
    })
    // Provider-controlled HTML must NOT be re-exposed on the wire (XSS sink).
    expect((result!.oembed as Record<string, unknown>).html).toBeUndefined()
    expect(result!.media_type).toBe('video')
  })

  test('returns null when provider responds non-2xx', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 404 }))
    const result = await runOembed('https://www.youtube.com/watch?v=abc')
    expect(result).toBeNull()
  })

  test('returns null when fetch throws (network / abort)', async () => {
    fetchSpy.mockRejectedValue(new Error('aborted'))
    const result = await runOembed('https://www.youtube.com/watch?v=abc')
    expect(result).toBeNull()
  })

  test('respects per-call timeout via AbortSignal', async () => {
    let receivedSignal: AbortSignal | undefined
    fetchSpy.mockImplementation(async (_url, init) => {
      receivedSignal = (init as RequestInit).signal as AbortSignal
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    })
    await runOembed('https://www.youtube.com/watch?v=abc')
    expect(receivedSignal).toBeDefined()
  })
})
