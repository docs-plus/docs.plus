import { safeFetch } from '../ssrf'
import { LINK_PREVIEW_USER_AGENT, STAGE_TIMEOUT_MS, type StageResult } from '../types'

interface ProviderEntry {
  match: (host: string) => boolean
  /** Only these paths have an oEmbed answer. Other paths go straight to the next stage. */
  path?: RegExp
  endpoint: (url: string) => string
}

/** Endpoints come from each provider's published oEmbed docs (the oembed.com
 *  registry). No two entries match the same URL, so entry order does not matter. */
const PROVIDERS: ProviderEntry[] = [
  {
    match: (h) => /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(h),
    endpoint: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)vimeo\.com$/.test(h),
    endpoint: (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)twitter\.com$|(^|\.)x\.com$/.test(h),
    endpoint: (u) => `https://publish.x.com/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)reddit\.com$/.test(h),
    path: /^\/r\/[^/]+\/comments\//,
    endpoint: (u) => `https://www.reddit.com/oembed?url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)gist\.github\.com$/.test(h),
    endpoint: (u) => `https://github.com/api/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)codepen\.io$/.test(h),
    endpoint: (u) => `https://codepen.io/api/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)figma\.com$/.test(h),
    endpoint: (u) => `https://www.figma.com/api/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)loom\.com$/.test(h),
    endpoint: (u) => `https://www.loom.com/v1/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)tiktok\.com$/.test(h),
    endpoint: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`
  }
]

interface OembedJson {
  type?: 'video' | 'rich' | 'photo' | 'link'
  title?: string
  author_name?: string
  author_url?: string
  provider_name?: string
  provider_url?: string
  thumbnail_url?: string
  html?: string
  width?: number
  height?: number
}

const findProvider = (url: string): ProviderEntry | null => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.toLowerCase()
  return PROVIDERS.find((p) => p.match(host) && (p.path?.test(parsed.pathname) ?? true)) ?? null
}

const oembedTypeToMediaType = (
  type: OembedJson['type']
): NonNullable<StageResult>['media_type'] => {
  if (type === 'video') return 'video'
  if (type === 'photo') return 'image'
  return 'website'
}

/** Null is not an error: the pipeline falls through to the next stage on it. */
export const runOembed = async (canonicalUrl: string): Promise<StageResult> => {
  const provider = findProvider(canonicalUrl)
  if (!provider) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STAGE_TIMEOUT_MS.oembed)

  try {
    const response = await safeFetch(provider.endpoint(canonicalUrl), {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': LINK_PREVIEW_USER_AGENT }
    })
    if (!response.ok) return null

    const data = (await response.json()) as OembedJson
    // A reply with no title is a miss. The hostname as title was cached as a 24 h positive.
    if (!data.title) return null

    return {
      success: true,
      url: canonicalUrl,
      requested_url: canonicalUrl,
      title: data.title,
      media_type: oembedTypeToMediaType(data.type),
      author:
        data.author_name || data.author_url
          ? { name: data.author_name, url: data.author_url }
          : undefined,
      publisher:
        data.provider_name || data.provider_url
          ? { name: data.provider_name, url: data.provider_url }
          : undefined,
      image: data.thumbnail_url ? { url: data.thumbnail_url } : undefined,
      oembed: {
        type: data.type ?? 'rich',
        provider: data.provider_name ?? '',
        width: data.width,
        height: data.height,
        thumbnail: data.thumbnail_url
      }
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
