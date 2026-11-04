import * as dns from 'node:dns/promises'

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { decodeHTML } from 'entities'

import { runSpecialHandler } from '../../domain/stages/handlers'
import type { ApiKeys } from '../../domain/types'
import githubRepo from '../fixtures/github-repo.json'
import soQuestion from '../fixtures/stackexchange-question.json'
import soUnaccepted from '../fixtures/stackexchange-unaccepted.json'

// Recorded from api.github.com and api.stackexchange.com on 2026-11-03.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const NO_KEYS: ApiKeys = { githubToken: null, stackExchangeKey: null }
const special = (url: string, keys = NO_KEYS) => runSpecialHandler(url, keys, decodeHTML)

const card = async (url: string, keys = NO_KEYS) => {
  const result = await special(url, keys)
  if (!result || typeof result === 'string') throw new Error(`expected a card, got ${result}`)
  return result
}

describe('runSpecialHandler', () => {
  let fetchSpy: ReturnType<typeof spyOn>
  let dnsSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch')
    // safeFetch resolves the host before it fetches. A live lookup made CI wait on
    // a slow resolver until the stage timeout, so answer with a public address.
    dnsSpy = spyOn(dns, 'lookup').mockResolvedValue([
      { address: '93.184.216.34', family: 4 }
    ] as never)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    dnsSpy.mockRestore()
  })

  test('returns null for hosts without a special handler', async () => {
    const result = await special('https://random.example.com/x')
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

      const result = await card('https://github.com/docsplus/docsy')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/docsplus/docsy',
        expect.objectContaining({ headers: expect.any(Object) })
      )
      expect(result?.title).toBe('docsplus/docsy')
      expect(result?.description).toBe('collaborative docs')
      expect(result?.publisher?.name).toBe('GitHub')
      expect(result?.image?.url).toBe('https://avatars.githubusercontent.com/x')
    })

    test('maps a recorded repo to a repo card with stars, language and the last push', async () => {
      fetchSpy.mockResolvedValue(json(githubRepo))
      const result = await card('https://github.com/docs-plus/docs.plus')

      expect(result.kind).toBe('repo')
      expect(result.title).toBe('docs-plus/docs.plus')
      expect(result.image?.url).toBe('https://avatars.githubusercontent.com/u/111438483?v=4')
      expect(result.facts?.slice(0, 2)).toEqual([
        { icon: 'stars', text: '97' },
        { icon: 'language', text: 'TypeScript' }
      ])
      // pushed_at, not updated_at: github.com's "Updated" follows the last push.
      expect(result.facts?.[2]?.text).toMatch(/^Updated Nov 3(, 2026)?$/)
    })

    test('sends the token as a Bearer header', async () => {
      // A wrong header drops to the anonymous rate limit, seen only as rate-limit misses.
      fetchSpy.mockResolvedValue(json(githubRepo))
      await card('https://github.com/docs-plus/docs.plus', { ...NO_KEYS, githubToken: 't0k' })
      expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe('Bearer t0k')
    })

    test('a rate limit or a 5xx may clear soon; a 404 or a private repo is a lasting miss', async () => {
      const outcome = async (response: Response) => {
        fetchSpy.mockResolvedValue(response)
        return special('https://github.com/docs-plus/docs.plus')
      }
      expect(await outcome(json({ message: 'API rate limit exceeded' }, 403))).toBe('rate-limit')
      expect(await outcome(json({}, 429))).toBe('rate-limit')
      expect(await outcome(new Response('', { status: 503 }))).toBe('status:5xx')
      expect(await outcome(json({ message: 'Not Found' }, 404))).toBeNull()
      expect(await outcome(json({ ...githubRepo, private: true }))).toBeNull()
      // The body is read through a 64 KiB cap, so a huge answer is never parsed.
      expect(await outcome(json({ ...githubRepo, description: 'd'.repeat(70_000) }))).toBeNull()
    })

    test('skips non-repo github paths (issues, pulls, etc.)', async () => {
      const result = await special('https://github.com/docsplus/docsy/issues/123')
      expect(result).toBeNull()
    })
  })

  describe('stack overflow', () => {
    const QUESTION =
      'https://stackoverflow.com/questions/1452721/whats-the-problem-with-using-namespace-std'

    test('maps a recorded question: decoded title, answers and the accepted answer', async () => {
      fetchSpy.mockResolvedValue(json(soQuestion))
      const result = await card(QUESTION, { ...NO_KEYS, stackExchangeKey: 'k&1' })

      expect(fetchSpy.mock.calls[0][0]).toBe(
        'https://api.stackexchange.com/2.3/questions/1452721?site=stackoverflow&key=k%261'
      )
      expect(result.title).toBe('What\'s the problem with "using namespace std;"?')
      expect(result.facts).toEqual([
        { icon: 'answers', text: '39 answers' },
        { icon: 'accepted', text: 'Accepted answer' }
      ])
    })

    test('leaves out the accepted fact when no answer is accepted', async () => {
      fetchSpy.mockResolvedValue(json(soUnaccepted))
      const result = await card('https://stackoverflow.com/questions/1575141')
      expect(result.facts).toEqual([{ icon: 'answers', text: '44 answers' }])
    })

    test('a throttle is HTTP 400 with error_id 502; a bad key or a missing question is a lasting miss', async () => {
      const outcome = async (response: Response) => {
        fetchSpy.mockResolvedValue(response)
        return special(QUESTION)
      }
      expect(await outcome(json({ error_id: 502, error_name: 'throttle_violation' }, 400))).toBe(
        'rate-limit'
      )
      expect(
        await outcome(json({ error_id: 503, error_name: 'temporarily_unavailable' }, 400))
      ).toBe('status:5xx')
      expect(await outcome(json({ error_id: 400, error_name: 'bad_parameter' }, 400))).toBeNull()
      expect(await outcome(json({ items: [], quota_remaining: 290 }))).toBeNull()
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

      const result = await card('https://en.wikipedia.org/wiki/Albert_Einstein')

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

      const result = await card('https://www.reddit.com/r/programming/comments/abc/cool_post')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.reddit.com/r/programming/comments/abc/cool_post.json?limit=1',
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

      await special('https://www.reddit.com/r/x/comments/abc/post?context=3')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.reddit.com/r/x/comments/abc/post.json?context=3&limit=1',
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

      await special('https://www.reddit.com/r/x/comments/abc/post#anchor')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.reddit.com/r/x/comments/abc/post.json?limit=1#anchor',
        expect.any(Object)
      )
    })
  })

  test('returns null on non-2xx', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 404 }))
    const result = await special('https://github.com/docsplus/docsy')
    expect(result).toBeNull()
  })
})
