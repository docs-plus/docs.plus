import { BOT_USER_AGENT, type StageResult } from '../../types'

export const matchesReddit = (host: string, path: string): boolean =>
  /(^|\.)reddit\.com$/.test(host) && /^\/r\/[^/]+\/comments\//.test(path)

interface RedditListing {
  data?: {
    children?: Array<{
      data?: {
        title?: string
        selftext?: string
        author?: string
        subreddit_name_prefixed?: string
        thumbnail?: string
      }
    }>
  }
}

export const runReddit = async (
  canonicalUrl: string,
  signal: AbortSignal
): Promise<StageResult> => {
  let jsonUrl: string
  try {
    const u = new URL(canonicalUrl)
    if (!u.pathname.endsWith('.json')) u.pathname += '.json'
    jsonUrl = u.toString()
  } catch {
    return null
  }
  const response = await fetch(jsonUrl, {
    signal,
    headers: { Accept: 'application/json', 'User-Agent': BOT_USER_AGENT }
  })
  if (!response.ok) return null
  const listings = (await response.json()) as RedditListing[]
  const post = listings[0]?.data?.children?.[0]?.data
  if (!post?.title) return null

  const validThumbnail =
    post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : undefined

  return {
    success: true,
    url: canonicalUrl,
    requested_url: canonicalUrl,
    title: post.title,
    description: post.selftext || undefined,
    author: post.author ? { name: post.author } : undefined,
    publisher: post.subreddit_name_prefixed
      ? { name: post.subreddit_name_prefixed, url: 'https://www.reddit.com' }
      : { name: 'Reddit', url: 'https://www.reddit.com' },
    image: validThumbnail ? { url: validThumbnail } : undefined
  }
}
