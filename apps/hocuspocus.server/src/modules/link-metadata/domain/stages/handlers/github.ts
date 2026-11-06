import { compactCount, factDate } from '../../facts'
import { readApiJson } from '../../readApiJson'
import { safeFetch } from '../../ssrf'
import { type Fact, LINK_PREVIEW_USER_AGENT, type SpecialMiss, type StageResult } from '../../types'

const REPO_PATH = /^\/([^/]+)\/([^/]+)\/?$/
// github.com serves its own pages at these first segments, so such a URL never opens a
// repository. Asking the API would spend one call of the anonymous 60-an-hour budget on a 404.
const NOT_OWNERS = new Set([
  'about',
  'apps',
  'collections',
  'enterprise',
  'events',
  'explore',
  'features',
  'join',
  'login',
  'marketplace',
  'notifications',
  'orgs',
  'pricing',
  'settings',
  'sponsors',
  'topics',
  'trending'
])

export const matchesGithub = (
  host: string,
  path: string
): { owner: string; repo: string } | null => {
  if (host !== 'github.com' && host !== 'www.github.com') return null
  const m = REPO_PATH.exec(path)
  return m && !NOT_OWNERS.has(m[1].toLowerCase()) ? { owner: m[1], repo: m[2] } : null
}

interface RepoJson {
  full_name?: string
  description?: string
  language?: string
  stargazers_count?: number
  pushed_at?: string
  updated_at?: string
  private?: boolean
  owner?: { avatar_url?: string }
}

/** `pushed_at` is what github.com shows as "Updated"; `updated_at` also moves on metadata edits. */
const repoFacts = (data: RepoJson): Fact[] => {
  const facts: Fact[] = []
  if (typeof data.stargazers_count === 'number' && data.stargazers_count >= 0) {
    facts.push({ icon: 'stars', text: compactCount(data.stargazers_count) })
  }
  if (typeof data.language === 'string' && data.language) {
    facts.push({ icon: 'language', text: data.language })
  }
  const updated = factDate(data.pushed_at ?? data.updated_at, new Date())
  if (updated) facts.push({ icon: 'updated', text: `Updated ${updated}` })
  return facts
}

/** GitHub answers a spent rate limit with 403 or 429. */
export const runGithub = async (
  canonicalUrl: string,
  owner: string,
  repo: string,
  hop: AbortController,
  token: string | null
): Promise<StageResult | SpecialMiss> => {
  const response = await safeFetch(`https://api.github.com/repos/${owner}/${repo}`, {
    signal: hop.signal,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': LINK_PREVIEW_USER_AGENT,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  if (response.status === 403 || response.status === 429) return 'rate-limit'
  if (response.status >= 500) return 'status:5xx'
  if (!response.ok) return null
  const data = await readApiJson<RepoJson>(response, hop)
  if (!data) return null
  // A token that can read a private repository must not show its name to every reader.
  if (data.private === true) return null

  const facts = repoFacts(data)
  return {
    success: true,
    url: canonicalUrl,
    requested_url: canonicalUrl,
    title: data.full_name ?? `${owner}/${repo}`,
    description: data.description,
    publisher: { name: 'GitHub', url: 'https://github.com' },
    image: data.owner?.avatar_url ? { url: data.owner.avatar_url } : undefined,
    kind: 'repo',
    facts: facts.length > 0 ? facts : undefined
  }
}
