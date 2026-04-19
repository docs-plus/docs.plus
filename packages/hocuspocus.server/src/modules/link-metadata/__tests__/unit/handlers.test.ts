import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { runSpecialHandler } from '../../domain/stages/handlers'

describe('runSpecialHandler', () => {
  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test('returns null for hosts without a special handler', async () => {
    const result = await runSpecialHandler('https://random.example.com/x')
    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  describe('github', () => {
    test('fetches api.github.com/repos/{owner}/{repo} and normalizes', async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({
            full_name: 'docsplus/docsy',
            description: 'collaborative docs',
            html_url: 'https://github.com/docsplus/docsy',
            stargazers_count: 42,
            language: 'TypeScript',
            owner: { avatar_url: 'https://avatars.githubusercontent.com/x' }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

      const result = await runSpecialHandler('https://github.com/docsplus/docsy')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/docsplus/docsy',
        expect.objectContaining({ headers: expect.any(Object) })
      )
      expect(result?.title).toBe('docsplus/docsy')
      expect(result?.description).toBe('collaborative docs')
      expect(result?.publisher?.name).toBe('GitHub')
      expect(result?.image?.url).toBe('https://avatars.githubusercontent.com/x')
    })

    test('skips non-repo github paths (issues, pulls, etc.)', async () => {
      const result = await runSpecialHandler('https://github.com/docsplus/docsy/issues/123')
      expect(result).toBeNull()
    })
  })

  describe('wikipedia', () => {
    test('fetches REST summary and normalizes', async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Albert Einstein',
            extract: 'Theoretical physicist',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Albert_Einstein' } },
            thumbnail: { source: 'https://upload.wikimedia.org/x.jpg', width: 200, height: 250 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

      const result = await runSpecialHandler('https://en.wikipedia.org/wiki/Albert_Einstein')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://en.wikipedia.org/api/rest_v1/page/summary/Albert_Einstein',
        expect.any(Object)
      )
      expect(result?.title).toBe('Albert Einstein')
      expect(result?.description).toBe('Theoretical physicist')
      expect(result?.image?.url).toBe('https://upload.wikimedia.org/x.jpg')
      expect(result?.publisher?.name).toBe('Wikipedia')
    })
  })

  describe('reddit', () => {
    test('appends .json and parses first listing', async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              data: {
                children: [
                  {
                    data: {
                      title: 'Cool post',
                      selftext: 'lorem ipsum',
                      author: 'someuser',
                      subreddit_name_prefixed: 'r/programming',
                      thumbnail: 'https://b.thumbs.redditmedia.com/x.jpg'
                    }
                  }
                ]
              }
            }
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

      const result = await runSpecialHandler(
        'https://www.reddit.com/r/programming/comments/abc/cool_post'
      )

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.reddit.com/r/programming/comments/abc/cool_post.json',
        expect.any(Object)
      )
      expect(result?.title).toBe('Cool post')
      expect(result?.author?.name).toBe('someuser')
      expect(result?.publisher?.name).toBe('r/programming')
    })

    test('appends .json to the pathname even when the URL has a query string', async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify([
            { data: { children: [{ data: { title: 'Q post', subreddit_name_prefixed: 'r/x' } }] } }
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

      await runSpecialHandler('https://www.reddit.com/r/x/comments/abc/post?context=3')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.reddit.com/r/x/comments/abc/post.json?context=3',
        expect.any(Object)
      )
    })

    test('appends .json to the pathname even when the URL has a fragment', async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify([
            { data: { children: [{ data: { title: 'F post', subreddit_name_prefixed: 'r/x' } }] } }
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

      await runSpecialHandler('https://www.reddit.com/r/x/comments/abc/post#anchor')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.reddit.com/r/x/comments/abc/post.json#anchor',
        expect.any(Object)
      )
    })
  })

  test('returns null on non-2xx', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 404 }))
    const result = await runSpecialHandler('https://github.com/docsplus/docsy')
    expect(result).toBeNull()
  })
})
