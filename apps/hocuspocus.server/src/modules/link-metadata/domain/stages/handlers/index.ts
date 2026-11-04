import { type ApiKeys, type SpecialMiss, STAGE_TIMEOUT_MS, type StageResult } from '../../types'
import { matchesGithub, runGithub } from './github'
import { matchesReddit, runReddit } from './reddit'
import { matchesStackOverflow, runStackOverflow } from './stackoverflow'
import { matchesWikipedia, runWikipedia } from './wikipedia'

/**
 * Try the first matching special handler. Null is a lasting miss: no match, a 4xx, an over-cap
 * body or bad JSON, and any non-2xx from Wikipedia or Reddit. A `SpecialMiss` may clear soon:
 * a timeout or network error from any handler, or a rate limit or 5xx from GitHub or Stack
 * Exchange. Either way the pipeline calls the html stage next.
 */
export const runSpecialHandler = async (
  canonicalUrl: string,
  keys: ApiKeys,
  decodeHtml: (text: string) => string
): Promise<StageResult | SpecialMiss> => {
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
    if (gh) {
      return await runGithub(canonicalUrl, gh.owner, gh.repo, controller, keys.githubToken)
    }

    const question = matchesStackOverflow(host, path)
    if (question) {
      return await runStackOverflow(
        canonicalUrl,
        question,
        controller,
        keys.stackExchangeKey,
        decodeHtml
      )
    }

    const wiki = matchesWikipedia(host, path)
    if (wiki) return await runWikipedia(canonicalUrl, wiki.lang, wiki.slug, controller)

    if (matchesReddit(host, path)) return await runReddit(canonicalUrl, controller)

    return null
  } catch {
    // An over-cap body aborts the controller too, but returns null and never reaches here.
    return controller.signal.aborted ? 'timeout' : 'error'
  } finally {
    clearTimeout(timer)
  }
}
