import { type StageResult } from '../../types'

const REPO_PATH = /^\/([^/]+)\/([^/]+)\/?$/

export const matchesGithub = (
  host: string,
  path: string
): { owner: string; repo: string } | null => {
  if (host !== 'github.com' && host !== 'www.github.com') return null
  const m = REPO_PATH.exec(path)
  return m ? { owner: m[1], repo: m[2] } : null
}

interface RepoJson {
  full_name?: string
  description?: string
  html_url?: string
  language?: string
  stargazers_count?: number
  owner?: { avatar_url?: string }
}

export const runGithub = async (
  canonicalUrl: string,
  owner: string,
  repo: string,
  signal: AbortSignal
): Promise<StageResult> => {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    signal,
    headers: { Accept: 'application/vnd.github+json' }
  })
  if (!response.ok) return null
  const data = (await response.json()) as RepoJson

  return {
    success: true,
    url: canonicalUrl,
    requested_url: canonicalUrl,
    title: data.full_name ?? `${owner}/${repo}`,
    description: data.description,
    publisher: { name: 'GitHub', url: 'https://github.com' },
    image: data.owner?.avatar_url ? { url: data.owner.avatar_url } : undefined
  }
}
