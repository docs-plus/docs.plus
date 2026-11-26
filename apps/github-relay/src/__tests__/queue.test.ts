import { describe, expect, it } from 'bun:test'
import { createHmac } from 'crypto'

import { type GitHubApiClient, GitHubHttpClient } from '../github/client.ts'
import { WebhookRouter } from '../projection/router.ts'
import { ChannelQueue } from '../queue/channelQueue.ts'
import { createRelayHandler } from '../server.ts'
import { SqliteStore } from '../store/sqliteStore.ts'
import type { DigestSnapshot, DiscordTransport, DiscordV2Payload, RelayConfig } from '../types.ts'

class FakeDiscord implements DiscordTransport {
  calls: Array<{
    op: 'POST' | 'PATCH'
    channelId: string
    messageId?: string
    payload: DiscordV2Payload
  }> = []
  private nextId = 100000000000000000n
  delayMs = 0
  nextPatch404 = false

  async sendMessage(channelId: string, payload: DiscordV2Payload): Promise<{ id: string }> {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs))
    this.nextId += 1n
    const id = this.nextId.toString()
    this.calls.push({ op: 'POST', channelId, messageId: id, payload })
    return { id }
  }

  async editMessage(
    channelId: string,
    messageId: string,
    payload: DiscordV2Payload
  ): Promise<{ id: string } | { notFound: true }> {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs))
    if (this.nextPatch404) {
      this.nextPatch404 = false
      return { notFound: true }
    }
    this.calls.push({ op: 'PATCH', channelId, messageId, payload })
    return { id: messageId }
  }
}

const FAKE_GITHUB: GitHubApiClient = {
  async compareCommits() {
    return null
  },
  async fetchDigestSnapshot(repo): Promise<DigestSnapshot> {
    return {
      repo,
      nowMs: Date.now(),
      starsCount: 100,
      awaitingReviewPrs: [],
      unansweredExternalIssues: [],
      staleClaimedIssues: [],
      dependabotOpenPrs: [],
      featuredClaimableIssues: []
    }
  },
  async fetchPeriodReport(repo, kind, sinceMs, untilMs, periodLabel) {
    return {
      kind,
      repo,
      periodLabel,
      sinceMs,
      untilMs,
      starsCount: 100,
      commitsCount: 14,
      commitsCapped: false,
      releases: [
        {
          tagName: 'v2.4.0',
          name: 'v2.4.0',
          url: `https://github.com/${repo}/releases/tag/v2.4.0`,
          prerelease: false
        }
      ],
      mergedPrsCount: 6,
      closedIssuesCount: 9,
      contributors: ['HMarzban', 'sara'],
      featuredClaimableIssues: []
    }
  }
}

function makeConfig(): RelayConfig {
  return {
    port: 4050,
    sqlitePath: ':memory:',
    githubRepository: 'docs-plus/docs.plus',
    githubWebhookSecret: 'test-secret',
    githubToken: null,
    discordBotToken: 'bot-token',
    channels: {
      github: '100000000000000001',
      triage: '100000000000000002',
      releases: '100000000000000003'
    },
    hasDistinctTriageChannel: true,
    discordUsers: { HMarzban: '900000000000000001' },
    relayAdminToken: 'admin-token',
    pushCoalesceMs: 12000,
    issueOpenCoalesceMs: 10000,
    triageBurstWindowMs: 45000,
    starBurstWindowMs: 30000,
    digestEnabled: true,
    dailyDigestHourUtc: 9,
    biweeklyReportDayUtc: 5,
    biweeklyReportHourUtc: 16,
    monthlyReportDayUtc: 1,
    monthlyReportHourUtc: 16,
    appUrl: 'https://docs.plus',
    selfHostDocsUrl: 'https://github.com/docs-plus/docs.plus/blob/main/docs/self-hosting/README.md'
  }
}

function extractText(payload: DiscordV2Payload): string {
  return JSON.stringify(payload.components)
}

describe('ChannelQueue ordering, correlation, and living cards', () => {
  it('absorbs simultaneous push and issues.closed into one push card with zero interleaving', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    discord.delayMs = 5
    const queue = new ChannelQueue(config, store, discord, FAKE_GITHUB)
    const router = new WebhookRouter(config, store, queue)

    const t0 = 1_700_000_000_000
    const commits = Array.from({ length: 16 }, (_, idx) => ({
      id: `sha${String(idx).padStart(7, '0')}`,
      message: `fix(editor): item ${idx}`,
      author: { username: 'HMarzban' }
    }))

    router.route(
      'push',
      {
        ref: 'refs/heads/main',
        before: '0000001',
        after: 'sha0000015',
        compare: 'https://github.com/docs-plus/docs.plus/compare/0000001...sha0000015',
        sender: { login: 'HMarzban', type: 'User' },
        repository: { full_name: 'docs-plus/docs.plus', default_branch: 'main' },
        commits
      },
      t0
    )

    for (const num of [831, 832, 833]) {
      router.route(
        'issues',
        {
          action: 'closed',
          sender: { login: 'HMarzban', type: 'User' },
          issue: {
            number: num,
            title: `Issue ${num}`,
            html_url: `https://github.com/docs-plus/docs.plus/issues/${num}`,
            state: 'closed',
            user: { login: 'HMarzban', type: 'User' }
          },
          repository: { full_name: 'docs-plus/docs.plus' }
        },
        t0 + 100
      )
    }

    await queue.drainAll(t0 + 20_000)

    const githubPosts = discord.calls.filter((c) => c.channelId === config.channels.github)
    expect(githubPosts.length).toBe(1)
    const body = extractText(githubPosts[0].payload)
    expect(body).toContain('16 commits to main')
    expect(body).toContain('#831')
    expect(body).toContain('#832')
    expect(body).toContain('#833')
    store.close()
  })

  it('suppresses duplicate push card when a merged PR already announced the commit', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    const queue = new ChannelQueue(config, store, discord, FAKE_GITHUB)
    const router = new WebhookRouter(config, store, queue)
    const t0 = 1_700_000_000_000

    router.route(
      'pull_request',
      {
        action: 'closed',
        sender: { login: 'HMarzban', type: 'User' },
        pull_request: {
          number: 740,
          title: 'Merge fold refactor',
          html_url: 'https://github.com/docs-plus/docs.plus/pull/740',
          state: 'closed',
          merged: true,
          merge_commit_sha: 'abc9999',
          user: { login: 'alice', type: 'User' },
          author_association: 'FIRST_TIME_CONTRIBUTOR'
        },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      t0
    )

    router.route(
      'push',
      {
        ref: 'refs/heads/main',
        before: 'abc0000',
        after: 'abc9999',
        sender: { login: 'HMarzban', type: 'User' },
        repository: { full_name: 'docs-plus/docs.plus', default_branch: 'main' },
        commits: [
          { id: 'abc9999', message: 'Merge pull request #740', author: { username: 'HMarzban' } }
        ]
      },
      t0 + 500
    )

    await queue.drainAll(t0 + 20_000)

    expect(discord.calls.length).toBe(1)
    expect(extractText(discord.calls[0].payload)).toContain('PR Merged')
    store.close()
  })

  it('edits existing anchor via PATCH, sends message_reference reply, and recreates anchor on 404', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    const queue = new ChannelQueue(config, store, discord, FAKE_GITHUB)
    const router = new WebhookRouter(config, store, queue)
    const t0 = 1_700_000_000_000

    const pr = {
      number: 742,
      title: 'Fix scroll jump',
      html_url: 'https://github.com/docs-plus/docs.plus/pull/742',
      state: 'open' as const,
      draft: false,
      user: { login: 'alice', type: 'User' },
      author_association: 'FIRST_TIME_CONTRIBUTOR'
    }

    router.route(
      'pull_request',
      { action: 'opened', pull_request: pr, repository: { full_name: 'docs-plus/docs.plus' } },
      t0
    )
    await queue.drainAll(t0)
    const anchorId = discord.calls[0].messageId!

    router.route(
      'pull_request_review',
      {
        action: 'submitted',
        review: {
          state: 'changes_requested',
          body: 'Check Safari.',
          user: { login: 'HMarzban', type: 'User' }
        },
        pull_request: pr,
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      t0 + 1000
    )
    await queue.drainAll(t0 + 1000)

    const patchCall = discord.calls.find(
      (c) => c.op === 'PATCH' && c.channelId === config.channels.github
    )
    const replyCall = discord.calls.find(
      (c) => c.op === 'POST' && c.payload.message_reference?.message_id === anchorId
    )
    expect(patchCall?.messageId).toBe(anchorId)
    expect(replyCall?.payload.message_reference?.fail_if_not_exists).toBe(false)

    discord.nextPatch404 = true
    router.route(
      'pull_request',
      {
        action: 'closed',
        pull_request: { ...pr, state: 'closed', merged: true },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      t0 + 2000
    )
    await queue.drainAll(t0 + 2000)

    const recreated = discord.calls[discord.calls.length - 2]
    expect(recreated.op).toBe('POST')
    expect(store.getEntity('pr:742')?.anchorMessageId).toBe(recreated.messageId)
    store.close()
  })

  it('enforces 24h star cooldown while never blocking exact milestones', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    const queue = new ChannelQueue(config, store, discord, FAKE_GITHUB)
    const router = new WebhookRouter(config, store, queue)
    const t0 = 1_700_000_000_000

    router.route(
      'star',
      {
        action: 'created',
        sender: { login: 'flaky-user', type: 'User' },
        repository: { full_name: 'docs-plus/docs.plus', stargazers_count: 99 }
      },
      t0
    )
    await queue.drainAll(t0 + 40_000)
    expect(discord.calls.length).toBe(1)

    // Repeat star by same user within 24h at non-milestone count is ignored.
    router.route(
      'star',
      {
        action: 'created',
        sender: { login: 'flaky-user', type: 'User' },
        repository: { full_name: 'docs-plus/docs.plus', stargazers_count: 99 }
      },
      t0 + 60_000
    )
    await queue.drainAll(t0 + 120_000)
    expect(discord.calls.length).toBe(1)

    // Exact 100 milestone still announces even within cooldown.
    router.route(
      'star',
      {
        action: 'created',
        sender: { login: 'flaky-user', type: 'User' },
        repository: { full_name: 'docs-plus/docs.plus', stargazers_count: 100 }
      },
      t0 + 180_000
    )
    await queue.drainAll(t0 + 240_000)
    expect(discord.calls.length).toBe(2)
    expect(extractText(discord.calls[1].payload)).toContain('100 Stars')
    store.close()
  })

  it('deduplicates X-GitHub-Delivery and rejects bad signatures at the HTTP handler', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    const queue = new ChannelQueue(config, store, discord, FAKE_GITHUB)
    const handler = createRelayHandler({ config, store, queue })

    const payload = JSON.stringify({
      action: 'created',
      sender: { login: 'maya', type: 'User' },
      repository: { full_name: 'docs-plus/docs.plus', stargazers_count: 99 }
    })
    const sig = `sha256=${createHmac('sha256', config.githubWebhookSecret).update(payload).digest('hex')}`

    const badRes = await handler(
      new Request('http://localhost/webhook/github', {
        method: 'POST',
        headers: { 'x-hub-signature-256': 'sha256=deadbeef', 'x-github-event': 'star' },
        body: payload
      })
    )
    expect(badRes.status).toBe(401)

    const reqInit = {
      method: 'POST',
      headers: {
        'x-hub-signature-256': sig,
        'x-github-event': 'star',
        'x-github-delivery': 'deliv-1'
      },
      body: payload
    }

    const first = await handler(new Request('http://localhost/webhook/github', reqInit))
    expect(first.status).toBe(202)
    const dup = await handler(new Request('http://localhost/webhook/github', reqInit))
    expect(dup.status).toBe(202)
    expect(await dup.json()).toEqual({ ok: true, duplicate: true })

    await queue.drainAll(Date.now() + 60_000)
    expect(discord.calls.length).toBe(1)
    store.close()
  })

  it('does not burn X-GitHub-Delivery on invalid JSON before retry', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    const queue = new ChannelQueue(config, store, discord, FAKE_GITHUB)
    const handler = createRelayHandler({ config, store, queue })

    const badBody = 'payload=not-json'
    const badSig = `sha256=${createHmac('sha256', config.githubWebhookSecret).update(badBody).digest('hex')}`
    const badRes = await handler(
      new Request('http://localhost/webhook/github', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': badSig,
          'x-github-event': 'star',
          'x-github-delivery': 'deliv-retry'
        },
        body: badBody
      })
    )
    expect(badRes.status).toBe(400)

    const validBody = JSON.stringify({
      action: 'created',
      sender: { login: 'maya', type: 'User' },
      repository: { full_name: 'docs-plus/docs.plus', stargazers_count: 99 }
    })
    const validSig = `sha256=${createHmac('sha256', config.githubWebhookSecret).update(validBody).digest('hex')}`
    const retryRes = await handler(
      new Request('http://localhost/webhook/github', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': validSig,
          'x-github-event': 'star',
          'x-github-delivery': 'deliv-retry'
        },
        body: validBody
      })
    )
    expect(retryRes.status).toBe(202)
    expect(await retryRes.json()).toEqual({ ok: true, queued: true })

    await queue.drainAll(Date.now() + 60_000)
    expect(discord.calls.length).toBe(1)
    store.close()
  })

  it('falls back to unauthenticated fetch when GitHubHttpClient gets 403', async () => {
    const origFetch = globalThis.fetch
    const authHeaders: Array<string | undefined> = []

    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      authHeaders.push(headers.Authorization)
      if (headers.Authorization) {
        return new Response('forbidden', { status: 403 })
      }
      return new Response(
        JSON.stringify({
          commits: [
            {
              sha: 'abc1234',
              commit: { message: 'fix: retry unauth', author: { name: 'Maya' } },
              author: { login: 'maya' }
            }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }) as unknown as typeof fetch

    try {
      const client = new GitHubHttpClient('bad-token')
      const commits = await client.compareCommits('docs-plus/docs.plus', '000', '111')
      expect(authHeaders).toEqual(['Bearer bad-token', undefined])
      expect(commits).toEqual([{ id: 'abc1234', message: 'fix: retry unauth', author: 'maya' }])
    } finally {
      globalThis.fetch = origFetch
    }
  })

  it('serves biweekly and monthly reports via POST /internal/digest with runKey dedup', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    const queue = new ChannelQueue(config, store, discord, FAKE_GITHUB)
    const handler = createRelayHandler({ config, store, queue })
    const headers = {
      Authorization: 'Bearer admin-token',
      'Content-Type': 'application/json'
    }

    const rejected = await handler(
      new Request('http://localhost/internal/digest', {
        method: 'POST',
        headers,
        body: JSON.stringify({ kind: 'weekly' })
      })
    )
    expect(rejected.status).toBe(400)

    const biweekly = await handler(
      new Request('http://localhost/internal/digest', {
        method: 'POST',
        headers,
        body: JSON.stringify({ kind: 'biweekly' })
      })
    )
    expect(biweekly.status).toBe(200)
    expect(await biweekly.json()).toEqual({ ok: true, posted: true })

    const dupBiweekly = await handler(
      new Request('http://localhost/internal/digest', {
        method: 'POST',
        headers,
        body: JSON.stringify({ kind: 'biweekly' })
      })
    )
    expect(dupBiweekly.status).toBe(200)
    expect(await dupBiweekly.json()).toEqual({ ok: true, posted: false })

    const forcedBiweekly = await handler(
      new Request('http://localhost/internal/digest', {
        method: 'POST',
        headers,
        body: JSON.stringify({ kind: 'biweekly', force: true })
      })
    )
    expect(forcedBiweekly.status).toBe(200)
    expect(await forcedBiweekly.json()).toEqual({ ok: true, posted: true })

    const monthly = await handler(
      new Request('http://localhost/internal/digest', {
        method: 'POST',
        headers,
        body: JSON.stringify({ kind: 'monthly' })
      })
    )
    expect(monthly.status).toBe(200)
    expect(await monthly.json()).toEqual({ ok: true, posted: true })

    expect(discord.calls.length).toBe(3)
    expect(discord.calls.every((c) => c.channelId === config.channels.github)).toBe(true)
    expect(extractText(discord.calls[0].payload)).toContain('2-Week Report')
    expect(extractText(discord.calls[2].payload)).toContain('Monthly Report')
    store.close()
  })
})
