import { STAGE_TIMEOUT_MS, type StageResult } from '../../types'
import { matchesGithub, runGithub } from './github'
import { matchesReddit, runReddit } from './reddit'
import { matchesWikipedia, runWikipedia } from './wikipedia'

/**
 * Try the first matching special handler. Returns null on no-match,
 * non-2xx, abort, or unparseable JSON. The pipeline calls the next stage
 * (HTML scrape) on null.
 */
export const runSpecialHandler = async (canonicalUrl: string): Promise<StageResult> => {
  let parsed: URL
  try {
    parsed = new URL(canonicalUrl)
  } catch {
    return null
  }

  const host = parsed.hostname.toLowerCase()
  const path = parsed.pathname

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STAGE_TIMEOUT_MS.special)

  try {
    const gh = matchesGithub(host, path)
    if (gh) return await runGithub(canonicalUrl, gh.owner, gh.repo, controller.signal)

    const wiki = matchesWikipedia(host, path)
    if (wiki) return await runWikipedia(canonicalUrl, wiki.lang, wiki.slug, controller.signal)

    if (matchesReddit(host, path)) return await runReddit(canonicalUrl, controller.signal)

    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
