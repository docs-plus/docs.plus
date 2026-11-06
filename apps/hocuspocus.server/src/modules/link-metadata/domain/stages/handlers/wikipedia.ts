import { readApiJson } from '../../readApiJson'
import { safeFetch } from '../../ssrf'
import { LINK_PREVIEW_USER_AGENT, type StageResult } from '../../types'

const WIKI_HOST = /^([a-z-]+)\.wikipedia\.org$/
const WIKI_PATH = /^\/wiki\/([^/]+)\/?$/

export const matchesWikipedia = (
  host: string,
  path: string
): { lang: string; slug: string } | null => {
  const hostMatch = WIKI_HOST.exec(host)
  if (!hostMatch) return null
  const pathMatch = WIKI_PATH.exec(path)
  if (!pathMatch) return null
  return { lang: hostMatch[1], slug: pathMatch[1] }
}

interface SummaryJson {
  title?: string
  extract?: string
  thumbnail?: { source?: string; width?: number; height?: number }
}

export const runWikipedia = async (
  canonicalUrl: string,
  lang: string,
  slug: string,
  hop: AbortController
): Promise<StageResult> => {
  const response = await safeFetch(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug}`,
    {
      signal: hop.signal,
      headers: { Accept: 'application/json', 'User-Agent': LINK_PREVIEW_USER_AGENT }
    }
  )
  if (!response.ok) return null
  const data = await readApiJson<SummaryJson>(response, hop)
  if (!data) return null

  return {
    success: true,
    url: canonicalUrl,
    requested_url: canonicalUrl,
    title: data.title ?? slug.replace(/_/g, ' '),
    description: data.extract,
    publisher: { name: 'Wikipedia', url: `https://${lang}.wikipedia.org` },
    image: data.thumbnail?.source
      ? { url: data.thumbnail.source, width: data.thumbnail.width, height: data.thumbnail.height }
      : undefined
  }
}
