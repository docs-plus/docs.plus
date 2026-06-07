import { STAGE_TIMEOUT_MS, type StageResult } from '../types'

interface ProviderEntry {
  match: (host: string) => boolean
  endpoint: (url: string) => string
}

/**
 * Provider registry. Each entry knows how to recognize a URL and where
 * to fetch its oEmbed JSON. Order doesn't matter; matching is hostname-based.
 *
 * Sources for endpoints: each provider's published oEmbed docs (oembed.com
 * registry). All these return JSON when given `?format=json&url=…`.
 */
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
    endpoint: (u) => `https://publish.twitter.com/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)open\.spotify\.com$|(^|\.)spotify\.com$/.test(h),
    endpoint: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)soundcloud\.com$/.test(h),
    endpoint: (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)reddit\.com$/.test(h),
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
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  return PROVIDERS.find((p) => p.match(host)) ?? null
}

const oembedTypeToMediaType = (
  type: OembedJson['type']
): NonNullable<StageResult>['media_type'] => {
  if (type === 'video') return 'video'
  if (type === 'photo') return 'image'
  return 'website'
}

/**
 * Fetch an oEmbed provider's JSON and normalize it into our response
 * shape. Returns null on no-match, non-2xx, abort, or unparseable JSON.
 * The pipeline calls the next stage on null.
 */
export const runOembed = async (canonicalUrl: string): Promise<StageResult> => {
  const provider = findProvider(canonicalUrl)
  if (!provider) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STAGE_TIMEOUT_MS.oembed)

  try {
    const response = await fetch(provider.endpoint(canonicalUrl), {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) return null

    const data = (await response.json()) as OembedJson

    return {
      success: true,
      url: canonicalUrl,
      requested_url: canonicalUrl,
      title: data.title || new URL(canonicalUrl).hostname,
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
