import { Database } from 'bun:sqlite'
import { describe, expect, it } from 'bun:test'
import { createHmac } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { DiscordApiError } from '../discord/client.ts'
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

    const githubCalls = discord.calls.filter((c) => c.channelId === config.channels.github)
    const recreated = githubCalls[githubCalls.length - 2]
    expect(recreated.op).toBe('POST')
    expect(store.getEntity('pr:742')?.anchorMessageId).toBe(recreated.messageId)
    const triagePatches = discord.calls.filter(
      (c) => c.channelId === config.channels.triage && c.op === 'PATCH'
    )
    expect(triagePatches.length).toBeGreaterThanOrEqual(2)
    expect(extractText(triagePatches[triagePatches.length - 1].payload)).toContain('PR Merged')
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

  it('persists entity state synchronously across back-to-back webhooks before Discord drains', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    const queue = new ChannelQueue(config, store, discord, FAKE_GITHUB)
    const router = new WebhookRouter(config, store, queue)
    const t0 = 1_700_000_000_000

    const pr = {
      number: 760,
      title: 'Back-to-back state persistence',
      html_url: 'https://github.com/docs-plus/docs.plus/pull/760',
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
    // Second webhook arrives before queue drains.
    router.route(
      'pull_request_review',
      {
        action: 'submitted',
        review: {
          state: 'changes_requested',
          body: 'Please add a guard.',
          user: { login: 'HMarzban', type: 'User' }
        },
        pull_request: pr,
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      t0 + 10
    )

    const preDrain = store.getEntity('pr:760')
    expect(preDrain?.anchorMessageId).toBeNull()
    expect(preDrain?.state.kind).toBe('pr')
    if (preDrain?.state.kind === 'pr') {
      expect(preDrain.state.timeline).toEqual(['Opened', 'Changes requested'])
      expect(preDrain.state.reviewers.HMarzban).toBe('changes_requested')
    }

    await queue.drainAll(t0 + 100)

    const githubCalls = discord.calls.filter((c) => c.channelId === config.channels.github)
    expect(githubCalls.map((c) => c.op)).toEqual(['POST', 'PATCH', 'POST'])
    const anchorId = githubCalls[0].messageId!
    expect(githubCalls[1].messageId).toBe(anchorId)
    expect(githubCalls[2].payload.message_reference?.message_id).toBe(anchorId)

    // Completing job 1 must not clobber state from webhook 2.
    const postDrain = store.getEntity('pr:760')
    expect(postDrain?.anchorMessageId).toBe(anchorId)
    if (postDrain?.state.kind === 'pr') {
      expect(postDrain.state.reviewers.HMarzban).toBe('changes_requested')
    }
    store.close()
  })

  it('preserves strict per-channel FIFO on retry and drops terminal 4xx immediately', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    let failFirstWith500 = true
    const sentTitles: string[] = []

    const transport: DiscordTransport = {
      async sendMessage(_channelId, payload) {
        const text = extractText(payload)
        if (text.includes('Job 1') && failFirstWith500) {
          failFirstWith500 = false
          throw new DiscordApiError('POST', 500, 'internal server error')
        }
        if (text.includes('Bad 400')) {
          throw new DiscordApiError('POST', 400, 'invalid component payload')
        }
        sentTitles.push(text)
        return { id: String(100000000000000000 + sentTitles.length) }
      },
      async editMessage(_channelId, messageId) {
        return { id: messageId }
      }
    }

    const queue = new ChannelQueue(config, store, transport, FAKE_GITHUB)
    const t0 = 1_700_000_000_000

    store.enqueueJob(
      'github',
      'test.1',
      {
        op: 'post',
        card: {
          accentColor: null,
          stateBadge: 'Test',
          title: 'Job 1',
          sections: [],
          footer: '',
          silent: true
        }
      },
      { nowMs: t0 }
    )
    store.enqueueJob(
      'github',
      'test.2',
      {
        op: 'post',
        card: {
          accentColor: null,
          stateBadge: 'Test',
          title: 'Job 2',
          sections: [],
          footer: '',
          silent: true
        }
      },
      { nowMs: t0 }
    )

    // First drain hits 500 on Job 1 and MUST NOT deliver Job 2 ahead of Job 1.
    await queue.drainAll(t0)
    expect(sentTitles.length).toBe(0)
    expect(store.countPendingJobs()).toBe(2)

    // Once backoff elapses, Job 1 delivers strictly before Job 2.
    await queue.drainAll(Date.now() + 10_000)
    expect(sentTitles.length).toBe(2)
    expect(sentTitles[0]).toContain('Job 1')
    expect(sentTitles[1]).toContain('Job 2')

    // Terminal 400 drops on first attempt so the next job proceeds immediately.
    store.enqueueJob(
      'github',
      'test.bad',
      {
        op: 'post',
        card: {
          accentColor: null,
          stateBadge: 'Test',
          title: 'Bad 400',
          sections: [],
          footer: '',
          silent: true
        }
      },
      { nowMs: t0 }
    )
    store.enqueueJob(
      'github',
      'test.after_bad',
      {
        op: 'post',
        card: {
          accentColor: null,
          stateBadge: 'Test',
          title: 'Job 3',
          sections: [],
          footer: '',
          silent: true
        }
      },
      { nowMs: t0 }
    )

    await queue.drainAll(Date.now() + 20_000)
    expect(store.countPendingJobs()).toBe(0)
    expect(sentTitles[2]).toContain('Job 3')
    store.close()
  })

  it('flushes batches atomically with single-flight guard and preserves batches on compareCommits failure', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    let compareCalls = 0
    let failCompare = true

    const github: GitHubApiClient = {
      ...FAKE_GITHUB,
      async compareCommits() {
        compareCalls += 1
        await new Promise((r) => setTimeout(r, 15))
        if (failCompare) throw new Error('GitHub 502')
        return Array.from({ length: 25 }, (_, i) => ({
          id: `fullsha${i}`,
          message: `fix: commit ${i}`,
          author: 'HMarzban'
        }))
      }
    }

    const queue = new ChannelQueue(config, store, discord, github)
    const t0 = 1_700_000_000_000
    queue.addPushItem(
      {
        repo: 'docs-plus/docs.plus',
        ref: 'refs/heads/main',
        before: '1111111',
        after: '2222222',
        compareUrl: '',
        pusher: 'HMarzban',
        commits: Array.from({ length: 20 }, (_, i) => ({
          id: `sha${i}`,
          message: `fix: item ${i}`,
          author: 'HMarzban'
        })),
        closedIssues: []
      },
      t0
    )

    // Failed compareCommits leaves pending_batches untouched in SQLite.
    await expect(queue.flushExpiredBatches(t0 + 20_000)).rejects.toThrow('GitHub 502')
    expect(store.peekExpiredBatches(t0 + 20_000).length).toBe(1)
    expect(store.countPendingJobs()).toBe(0)

    // Single-flight guard: concurrent flushes run compareCommits only once and stop() waits for it.
    failCompare = false
    compareCalls = 0
    const p1 = queue.flushExpiredBatches(t0 + 20_000)
    const p2 = queue.flushExpiredBatches(t0 + 20_000)
    const stopP = queue.stop()
    await Promise.all([p1, p2, stopP])

    expect(compareCalls).toBe(1)
    expect(store.peekExpiredBatches(t0 + 20_000).length).toBe(0)
    expect(store.countPendingJobs()).toBe(1)
    store.close()
  })

  it('holds issue_close while push is pending, extends issue_close burst, and filters merged pushes per item', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    const queue = new ChannelQueue(config, store, discord, FAKE_GITHUB)
    const router = new WebhookRouter(config, store, queue)
    const t0 = 1_700_000_000_000

    // Issue close arrives 1s BEFORE push.
    router.route(
      'issues',
      {
        action: 'closed',
        sender: { login: 'HMarzban', type: 'User' },
        issue: {
          number: 901,
          title: 'Closed by push',
          html_url: 'https://github.com/docs-plus/docs.plus/issues/901',
          state: 'closed',
          user: { login: 'HMarzban', type: 'User' }
        },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      t0
    )
    router.route(
      'push',
      {
        ref: 'refs/heads/main',
        before: '1111111',
        after: '2222222',
        sender: { login: 'HMarzban', type: 'User' },
        repository: { full_name: 'docs-plus/docs.plus', default_branch: 'main' },
        commits: [{ id: '2222222', message: 'fix: resolve #901', author: { username: 'HMarzban' } }]
      },
      t0 + 1000
    )

    // At t0 + 12_000, issue_close is expired but push expires at t0 + 13_000 -> hold issue_close!
    await queue.drainAll(t0 + 12_000)
    expect(discord.calls.length).toBe(0)

    // At t0 + 13_000, push flushes and absorbs issue #901 into a single card.
    await queue.drainAll(t0 + 13_000)
    expect(discord.calls.length).toBe(1)
    expect(extractText(discord.calls[0].payload)).toContain('#901')

    // Burst extension on addIssueCloseItem actually updates flushAt (and caps it).
    queue.addIssueCloseItem(
      {
        repo: 'docs-plus/docs.plus',
        action: 'closed',
        number: 910,
        title: 'One',
        url: 'https://github.com/docs-plus/docs.plus/issues/910',
        author: 'HMarzban',
        actor: 'HMarzban',
        outsider: false,
        labels: [],
        assignees: [],
        stateReason: '',
        closedByPr: null
      },
      t0 + 50_000
    )
    const firstFlushAt = store.getBatch('issue_close:docs-plus/docs.plus:HMarzban')!.flushAt
    queue.addIssueCloseItem(
      {
        repo: 'docs-plus/docs.plus',
        action: 'closed',
        number: 911,
        title: 'Two',
        url: 'https://github.com/docs-plus/docs.plus/issues/911',
        author: 'HMarzban',
        actor: 'HMarzban',
        outsider: false,
        labels: [],
        assignees: [],
        stateReason: '',
        closedByPr: null
      },
      t0 + 55_000
    )
    const extendedFlushAt = store.getBatch('issue_close:docs-plus/docs.plus:HMarzban')!.flushAt
    expect(extendedFlushAt).toBeGreaterThan(firstFlushAt)

    // Per-item merge suppression: suppress multi-commit merged PR push item, keep direct push item.
    store.recordRecentMerge('merged-sha', 800, t0 + 100_000)
    queue.addPushItem(
      {
        repo: 'docs-plus/docs.plus',
        ref: 'refs/heads/main',
        before: 'aaa',
        after: 'merged-sha',
        compareUrl: '',
        pusher: 'HMarzban',
        commits: [
          { id: 'c1', message: 'feat: inside pr', author: 'alice' },
          { id: 'merged-sha', message: 'Merge pull request #800', author: 'HMarzban' }
        ],
        closedIssues: []
      },
      t0 + 100_100
    )
    queue.addPushItem(
      {
        repo: 'docs-plus/docs.plus',
        ref: 'refs/heads/main',
        before: 'merged-sha',
        after: 'direct-sha',
        compareUrl: '',
        pusher: 'HMarzban',
        commits: [{ id: 'direct-sha', message: 'fix: direct hotfix', author: 'HMarzban' }],
        closedIssues: []
      },
      t0 + 100_200
    )
    const beforeCalls = discord.calls.length
    await queue.drainAll(t0 + 120_000)
    const pushCall = discord.calls
      .slice(beforeCalls)
      .find((c) => extractText(c.payload).includes('direct hotfix'))
    expect(pushCall).toBeDefined()
    expect(extractText(pushCall!.payload)).not.toContain('inside pr')
    store.close()
  })

  it('does not burn digest runKey during GitHub outage and skips unauth fallback on rate limit', async () => {
    const origFetch = globalThis.fetch
    let callCount = 0
    globalThis.fetch = (async () => {
      callCount += 1
      return new Response('rate limited', {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0' }
      })
    }) as unknown as typeof fetch

    try {
      const client = new GitHubHttpClient('valid-token')
      await expect(client.fetchDigestSnapshot('docs-plus/docs.plus')).rejects.toThrow()
      // Only 3 parallel primary calls, NO unauthenticated retries when x-ratelimit-remaining === '0'.
      expect(callCount).toBe(3)
    } finally {
      globalThis.fetch = origFetch
    }

    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    let outage = true
    const flakyGithub: GitHubApiClient = {
      ...FAKE_GITHUB,
      async fetchPeriodReport(repo, kind, sinceMs, untilMs, periodLabel) {
        if (outage) throw new Error('GitHub 503')
        return FAKE_GITHUB.fetchPeriodReport(repo, kind, sinceMs, untilMs, periodLabel)
      }
    }
    const queue = new ChannelQueue(config, store, discord, flakyGithub)
    const now = new Date('2026-11-27T16:00:00Z')

    await expect(queue.runDigest('biweekly', { now })).rejects.toThrow('GitHub 503')
    expect(store.hasRunKey('biweekly:2026-11-27')).toBe(false)

    outage = false
    const posted = await queue.runDigest('biweekly', { now })
    expect(posted).toBe(true)
    expect(store.hasRunKey('biweekly:2026-11-27')).toBe(true)
    store.close()
  })

  it('migrates legacy NOT NULL anchor_message_id SQLite DBs without data loss and handles bot-sender lifecycle events', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'github-relay-test-'))
    const dbPath = join(dir, 'legacy.sqlite')
    try {
      const rawDb = new Database(dbPath)
      rawDb.exec(`
        CREATE TABLE entities (
          entity_key TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          channel_key TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          anchor_message_id TEXT NOT NULL,
          state_json TEXT NOT NULL,
          timeline_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        INSERT INTO entities VALUES (
          'issue:42', 'issue', 'github', '100000000000000001', '555555555555555555',
          '{"kind":"issue","number":42,"title":"Legacy","url":"https://github.com/docs-plus/docs.plus/issues/42","author":"alice","outsider":true,"state":"open","stateReason":"","labels":["security"],"assignees":[],"commentCount":0,"linkedPrNumber":null,"timeline":["Opened"]}',
          '["Opened"]',
          1700000000000
        );
      `)
      rawDb.close()

      const store = new SqliteStore(dbPath)
      const migrated = store.getEntity('issue:42')
      expect(migrated?.anchorMessageId).toBe('555555555555555555')

      // Verify NULL anchor_message_id inserts succeed after migration.
      const config = makeConfig()
      const discord = new FakeDiscord()
      const queue = new ChannelQueue(config, store, discord, FAKE_GITHUB)
      const router = new WebhookRouter(config, store, queue)

      // Bot sender merging a human PR must still be processed.
      router.route(
        'pull_request',
        {
          action: 'opened',
          sender: { login: 'merge-bot[bot]', type: 'Bot' },
          pull_request: {
            number: 888,
            title: 'Human PR touched by bot',
            html_url: 'https://github.com/docs-plus/docs.plus/pull/888',
            state: 'open',
            draft: false,
            user: { login: 'alice', type: 'User' },
            author_association: 'FIRST_TIME_CONTRIBUTOR'
          },
          repository: { full_name: 'docs-plus/docs.plus' }
        },
        1_700_000_001_000
      )
      expect(store.getEntity('pr:888')?.anchorMessageId).toBeNull()
      await queue.drainAll(1_700_000_002_000)
      expect(store.getEntity('pr:888')?.anchorMessageId).toBeTruthy()
      store.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects non-object JSON payloads on /webhook/github and /internal/digest', async () => {
    const config = makeConfig()
    const store = new SqliteStore(':memory:')
    const discord = new FakeDiscord()
    const queue = new ChannelQueue(config, store, discord, FAKE_GITHUB)
    const handler = createRelayHandler({ config, store, queue })

    const nullBody = 'null'
    const sig = `sha256=${createHmac('sha256', config.githubWebhookSecret).update(nullBody).digest('hex')}`
    const badWebhook = await handler(
      new Request('http://localhost/webhook/github', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': sig,
          'x-github-event': 'star',
          'x-github-delivery': 'deliv-null'
        },
        body: nullBody
      })
    )
    expect(badWebhook.status).toBe(400)

    const badDigest = await handler(
      new Request('http://localhost/internal/digest', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: 'null'
      })
    )
    expect(badDigest.status).toBe(400)
    store.close()
  })
})
