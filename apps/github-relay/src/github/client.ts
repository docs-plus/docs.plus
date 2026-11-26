import type { DigestSnapshot, PeriodReportSnapshot } from '../types.ts'

export interface GitHubApiClient {
  compareCommits(
    repo: string,
    before: string,
    after: string
  ): Promise<Array<{ id: string; message: string; author: string }> | null>
  fetchDigestSnapshot(repo: string): Promise<DigestSnapshot>
  fetchPeriodReport(
    repo: string,
    kind: 'biweekly' | 'monthly',
    sinceMs: number,
    untilMs: number,
    periodLabel: string
  ): Promise<PeriodReportSnapshot>
}

export class GitHubHttpClient implements GitHubApiClient {
  private readonly token: string | null
  private warnedTokenFallback = false

  constructor(token: string | null) {
    this.token = token
  }

  private headers(
    accept = 'application/vnd.github+json',
    includeAuth = true
  ): Record<string, string> {
    const out: Record<string, string> = {
      Accept: accept,
      'User-Agent': 'docsplus-github-relay/1.0',
      'X-GitHub-Api-Version': '2022-11-28'
    }
    if (includeAuth && this.token) {
      out.Authorization = `Bearer ${this.token}`
    }
    return out
  }

  private async getJson<T>(url: string): Promise<T | null> {
    try {
      let res = await fetch(url, { headers: this.headers() })
      if (this.token && (res.status === 401 || res.status === 403)) {
        if (!this.warnedTokenFallback) {
          this.warnedTokenFallback = true
          console.warn(
            `[github] Authenticated request returned ${res.status}; retrying unauthenticated`
          )
        }
        res = await fetch(url, {
          headers: this.headers('application/vnd.github+json', false)
        })
      }
      if (!res.ok) return null
      return (await res.json()) as T
    } catch {
      return null
    }
  }

  async compareCommits(
    repo: string,
    before: string,
    after: string
  ): Promise<Array<{ id: string; message: string; author: string }> | null> {
    const data = await this.getJson<{
      commits?: Array<{
        sha: string
        commit: { message: string; author?: { name?: string } }
        author?: { login?: string } | null
      }>
    }>(`https://api.github.com/repos/${repo}/compare/${before}...${after}?per_page=100`)

    if (!data?.commits) return null
    return data.commits.map((c) => ({
      id: c.sha,
      message: c.commit.message,
      author: c.author?.login || c.commit.author?.name || 'unknown'
    }))
  }

  async fetchDigestSnapshot(repo: string): Promise<DigestSnapshot> {
    const nowMs = Date.now()
    const [repoInfo, openPrs, openIssues] = await Promise.all([
      this.getJson<{ stargazers_count?: number }>(`https://api.github.com/repos/${repo}`),
      this.getJson<
        Array<{
          number: number
          title: string
          html_url: string
          created_at: string
          updated_at: string
          draft?: boolean
          user: { login: string; type?: string }
          requested_reviewers?: Array<{ login: string }>
          head?: { sha: string }
        }>
      >(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=50`),
      this.getJson<
        Array<{
          number: number
          title: string
          html_url: string
          created_at: string
          updated_at: string
          comments: number
          user: { login: string; type?: string }
          author_association?: string
          assignees?: Array<{ login: string }>
          labels?: Array<{ name: string }>
          pull_request?: unknown
        }>
      >(`https://api.github.com/repos/${repo}/issues?state=open&per_page=60`)
    ])

    const awaitingReviewPrs: DigestSnapshot['awaitingReviewPrs'] = []
    const dependabotOpenPrs: number[] = []

    for (const pr of openPrs ?? []) {
      const isBot = pr.user.type === 'Bot' || pr.user.login.endsWith('[bot]')
      if (isBot) {
        if (pr.user.login.toLowerCase().includes('dependabot')) {
          dependabotOpenPrs.push(pr.number)
        }
        continue
      }
      if (pr.draft) continue
      const ageHours = Math.floor((nowMs - Date.parse(pr.updated_at)) / 3600_000)
      if (ageHours < 24) continue

      let ciStatus: 'passed' | 'failed' | 'pending' | 'unknown' = 'unknown'
      if (pr.head?.sha) {
        const status = await this.getJson<{ state?: string }>(
          `https://api.github.com/repos/${repo}/commits/${pr.head.sha}/status`
        )
        if (status?.state === 'success') ciStatus = 'passed'
        else if (status?.state === 'failure' || status?.state === 'error') ciStatus = 'failed'
        else if (status?.state === 'pending') ciStatus = 'pending'
      }

      const reviewers = (pr.requested_reviewers ?? []).map((r) => `@${r.login}`)
      awaitingReviewPrs.push({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        ageHours,
        ciStatus,
        waitingOn: reviewers.length > 0 ? reviewers.join(', ') : 'Maintainer review'
      })
    }

    const unansweredExternalIssues: DigestSnapshot['unansweredExternalIssues'] = []
    const staleClaimedIssues: DigestSnapshot['staleClaimedIssues'] = []
    const featuredClaimableIssues: DigestSnapshot['featuredClaimableIssues'] = []

    for (const item of openIssues ?? []) {
      if (item.pull_request) continue
      const isBot = item.user.type === 'Bot' || item.user.login.endsWith('[bot]')
      if (isBot) continue

      const assoc = item.author_association ?? ''
      const outsider = !['OWNER', 'MEMBER', 'COLLABORATOR'].includes(assoc)
      const ageHours = Math.floor((nowMs - Date.parse(item.created_at)) / 3600_000)
      const labels = (item.labels ?? []).map((l) => l.name)
      const lowerLabels = labels.map((l) => l.toLowerCase())
      const assignees = item.assignees ?? []

      if (outsider && item.comments === 0 && ageHours >= 24) {
        unansweredExternalIssues.push({
          number: item.number,
          title: item.title,
          url: item.html_url,
          author: item.user.login,
          ageHours,
          kind: 'issue'
        })
      }

      if (assignees.length > 0) {
        const updatedDays = Math.floor((nowMs - Date.parse(item.updated_at)) / 86400_000)
        if (updatedDays >= 7) {
          staleClaimedIssues.push({
            number: item.number,
            title: item.title,
            url: item.html_url,
            assignee: assignees[0].login,
            ageDays: updatedDays
          })
        }
      } else if (lowerLabels.includes('good first issue') || lowerLabels.includes('help wanted')) {
        featuredClaimableIssues.push({
          number: item.number,
          title: item.title,
          url: item.html_url,
          labels
        })
      }
    }

    if (this.token) {
      const [owner, name] = repo.split('/')
      if (owner && name) {
        try {
          const gql = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
              ...this.headers(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              query: `query($owner: String!, $name: String!) {
                repository(owner: $owner, name: $name) {
                  discussions(first: 15, orderBy: { field: CREATED_AT, direction: DESC }) {
                    nodes {
                      number title url createdAt isAnswered
                      author { login }
                      comments { totalCount }
                    }
                  }
                }
              }`,
              variables: { owner, name }
            })
          })
          if (gql.ok) {
            const payload = (await gql.json()) as {
              data?: {
                repository?: {
                  discussions?: {
                    nodes?: Array<{
                      number: number
                      title: string
                      url: string
                      createdAt: string
                      isAnswered: boolean
                      author?: { login?: string }
                      comments?: { totalCount?: number }
                    }>
                  }
                }
              }
            }
            for (const d of payload.data?.repository?.discussions?.nodes ?? []) {
              const ageHours = Math.floor((nowMs - Date.parse(d.createdAt)) / 3600_000)
              if (!d.isAnswered && (d.comments?.totalCount ?? 0) === 0 && ageHours >= 24) {
                unansweredExternalIssues.push({
                  number: d.number,
                  title: d.title,
                  url: d.url,
                  author: d.author?.login || 'community',
                  ageHours,
                  kind: 'discussion'
                })
              }
            }
          }
        } catch {
          // Discussions query is optional; continue with REST snapshot.
        }
      }
    }

    return {
      repo,
      nowMs,
      starsCount: repoInfo?.stargazers_count ?? 0,
      awaitingReviewPrs: awaitingReviewPrs.slice(0, 8),
      unansweredExternalIssues: unansweredExternalIssues.slice(0, 8),
      staleClaimedIssues: staleClaimedIssues.slice(0, 6),
      dependabotOpenPrs,
      featuredClaimableIssues: featuredClaimableIssues.slice(0, 3)
    }
  }

  async fetchPeriodReport(
    repo: string,
    kind: 'biweekly' | 'monthly',
    sinceMs: number,
    untilMs: number,
    periodLabel: string
  ): Promise<PeriodReportSnapshot> {
    const sinceIso = new Date(sinceMs).toISOString()
    const untilIso = new Date(untilMs).toISOString()
    const prQuery = encodeURIComponent(
      `repo:${repo} is:pr is:merged merged:${sinceIso}..${untilIso}`
    )
    const issueQuery = encodeURIComponent(
      `repo:${repo} is:issue is:closed closed:${sinceIso}..${untilIso}`
    )

    const [repoInfo, releasesRaw, mergedPrsSearch, closedIssuesSearch, openIssues] =
      await Promise.all([
        this.getJson<{ stargazers_count?: number; default_branch?: string }>(
          `https://api.github.com/repos/${repo}`
        ),
        this.getJson<
          Array<{
            tag_name: string
            name?: string | null
            html_url: string
            draft?: boolean
            prerelease?: boolean
            published_at?: string | null
            created_at?: string | null
          }>
        >(`https://api.github.com/repos/${repo}/releases?per_page=30`),
        this.getJson<{
          total_count?: number
          items?: Array<{ user?: { login?: string; type?: string } }>
        }>(`https://api.github.com/search/issues?q=${prQuery}&per_page=30`),
        this.getJson<{ total_count?: number }>(
          `https://api.github.com/search/issues?q=${issueQuery}&per_page=1`
        ),
        this.getJson<
          Array<{
            number: number
            title: string
            html_url: string
            user: { login: string; type?: string }
            assignees?: Array<{ login: string }>
            labels?: Array<{ name: string }>
            pull_request?: unknown
          }>
        >(`https://api.github.com/repos/${repo}/issues?state=open&per_page=50`)
      ])

    const isBotAuthor = (login?: string, type?: string, name?: string): boolean =>
      type === 'Bot' ||
      Boolean(login && login.endsWith('[bot]')) ||
      Boolean(name && name.endsWith('[bot]'))

    const defaultBranch = repoInfo?.default_branch || 'main'
    let commitsCount = 0
    let commitsCapped = false
    const contributorSet = new Set<string>()

    for (let page = 1; page <= 3; page += 1) {
      const pageItems = await this.getJson<
        Array<{
          author?: { login?: string; type?: string } | null
          commit?: { author?: { name?: string } }
        }>
      >(
        `https://api.github.com/repos/${repo}/commits?sha=${encodeURIComponent(defaultBranch)}&since=${encodeURIComponent(sinceIso)}&until=${encodeURIComponent(untilIso)}&per_page=100&page=${page}`
      )
      if (!pageItems) break

      for (const c of pageItems) {
        if (isBotAuthor(c.author?.login, c.author?.type, c.commit?.author?.name)) continue
        commitsCount += 1
        const contributor = c.author?.login || c.commit?.author?.name
        if (contributor) contributorSet.add(contributor)
      }

      if (pageItems.length < 100) break
      if (page === 3) commitsCapped = true
    }

    for (const pr of mergedPrsSearch?.items ?? []) {
      const login = pr.user?.login
      if (login && !isBotAuthor(login, pr.user?.type)) {
        contributorSet.add(login)
      }
    }

    const releases = (releasesRaw ?? [])
      .filter((r) => {
        if (r.draft) return false
        const publishedMs = Date.parse(r.published_at || r.created_at || '')
        return Number.isFinite(publishedMs) && publishedMs >= sinceMs && publishedMs < untilMs
      })
      .map((r) => ({
        tagName: r.tag_name,
        name: r.name || r.tag_name,
        url: r.html_url,
        prerelease: Boolean(r.prerelease)
      }))

    const featuredClaimableIssues: PeriodReportSnapshot['featuredClaimableIssues'] = []
    for (const item of openIssues ?? []) {
      if (item.pull_request) continue
      if (isBotAuthor(item.user.login, item.user.type)) continue
      if ((item.assignees ?? []).length > 0) continue
      const labels = (item.labels ?? []).map((l) => l.name)
      const lower = labels.map((l) => l.toLowerCase())
      if (lower.includes('good first issue') || lower.includes('help wanted')) {
        featuredClaimableIssues.push({
          number: item.number,
          title: item.title,
          url: item.html_url,
          labels
        })
      }
    }

    return {
      kind,
      repo,
      periodLabel,
      sinceMs,
      untilMs,
      starsCount: repoInfo?.stargazers_count ?? 0,
      commitsCount,
      commitsCapped,
      releases,
      mergedPrsCount: mergedPrsSearch?.total_count ?? 0,
      closedIssuesCount: closedIssuesSearch?.total_count ?? 0,
      contributors: Array.from(contributorSet).slice(0, 12),
      featuredClaimableIssues: featuredClaimableIssues.slice(0, 4)
    }
  }
}
