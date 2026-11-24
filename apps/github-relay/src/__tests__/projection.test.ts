import { describe, expect, it } from 'bun:test'

import { DISCORD_COLORS } from '../discord/renderer.ts'
import { projectDiscussionCommentEvent, projectDiscussionEvent } from '../projection/discussion.ts'
import {
  buildIssueCard,
  buildTriageBatchCard,
  projectIssueCommentEvent,
  projectIssueMutationEvent
} from '../projection/issue.ts'
import {
  projectPrCommentEvent,
  projectPullRequestEvent,
  projectPullRequestReviewEvent
} from '../projection/pullRequest.ts'
import { buildPushCard } from '../projection/push.ts'
import { buildReleaseProjection } from '../projection/release.ts'
import { buildStarCard } from '../projection/star.ts'
import type { IssueBatchItem, RelayConfig } from '../types.ts'

const TEST_CONFIG: RelayConfig = {
  port: 4050,
  sqlitePath: ':memory:',
  githubRepository: 'docs-plus/docs.plus',
  githubWebhookSecret: 'secret',
  githubToken: null,
  discordBotToken: 'bot-token',
  channels: {
    github: '100000000000000001',
    triage: '100000000000000002',
    releases: '100000000000000003'
  },
  hasDistinctTriageChannel: true,
  discordUsers: { HMarzban: '900000000000000001' },
  relayAdminToken: null,
  pushCoalesceMs: 12000,
  issueOpenCoalesceMs: 10000,
  triageBurstWindowMs: 45000,
  starBurstWindowMs: 30000,
  digestEnabled: true,
  dailyDigestHourUtc: 9,
  weeklyPulseDayUtc: 5,
  weeklyPulseHourUtc: 16,
  appUrl: 'https://docs.plus',
  selfHostDocsUrl: 'https://github.com/docs-plus/docs.plus/blob/main/docs/self-hosting/README.md'
}

describe('push projection', () => {
  it('drops (build): trigger commits and returns null when none remain', () => {
    const onlyTriggers = buildPushCard([
      {
        repo: 'docs-plus/docs.plus',
        ref: 'refs/heads/main',
        before: '1111111',
        after: '2222222',
        compareUrl: 'https://github.com/docs-plus/docs.plus/compare/1111111...2222222',
        pusher: 'HMarzban',
        commits: [{ id: '2222222', message: '(build): front back', author: 'HMarzban' }],
        closedIssues: []
      }
    ])
    expect(onlyTriggers).toBeNull()
  })

  it('builds compact 1-commit card vs grouped multi-commit card with correlated closures', () => {
    const single = buildPushCard([
      {
        repo: 'docs-plus/docs.plus',
        ref: 'refs/heads/main',
        before: '1111111',
        after: '2222222',
        compareUrl: 'https://github.com/docs-plus/docs.plus/compare/1111111...2222222',
        pusher: 'HMarzban',
        commits: [
          { id: '2222222', message: 'fix(toc): keep spy tick visible', author: 'HMarzban' },
          { id: '3333333', message: '(build): front', author: 'HMarzban' }
        ],
        closedIssues: []
      }
    ])
    expect(single?.stateBadge).toBe('Push · main')
    expect(single?.title).toBe('fix(toc): keep spy tick visible')
    expect(single?.footer).toContain('1 deploy trigger commit omitted')

    const multi = buildPushCard([
      {
        repo: 'docs-plus/docs.plus',
        ref: 'refs/heads/main',
        before: '1111111',
        after: '9999999',
        compareUrl: 'https://github.com/docs-plus/docs.plus/compare/1111111...9999999',
        pusher: 'HMarzban',
        commits: [
          { id: 'aaa1111', message: 'feat(editor): add fold memory', author: 'HMarzban' },
          { id: 'bbb2222', message: 'fix(chat): guard optimistic row', author: 'HMarzban' },
          { id: 'ccc3333', message: 'docs(readme): update install step', author: 'HMarzban' }
        ],
        closedIssues: [831, 832]
      }
    ])
    expect(multi?.title).toContain('3 commits to main')
    expect(multi?.sections.some((s) => s.includes('Features (1)'))).toBe(true)
    expect(multi?.sections.some((s) => s.includes('Fixes (1)'))).toBe(true)
    expect(multi?.sections.some((s) => s.includes('Closed in this push:'))).toBe(true)
  })
})

describe('release projection', () => {
  it('omits npm install on v* product releases and handles release.edited', () => {
    const res = buildReleaseProjection(
      {
        action: 'published',
        repository: { full_name: 'docs-plus/docs.plus' },
        release: {
          id: 901,
          tag_name: 'v2.3.6',
          name: 'docs.plus 2.3.6',
          html_url: 'https://github.com/docs-plus/docs.plus/releases/tag/v2.3.6',
          body: '<picture><img src="https://docs.plus/demo-assets/release-2.3.6-banner.png"></picture>\n\nFaster reads.',
          author: { login: 'HMarzban' }
        }
      },
      TEST_CONFIG
    )
    expect(res).not.toBeNull()
    expect(res?.card.bannerImageUrl).toBe('https://docs.plus/demo-assets/release-2.3.6-banner.png')
    expect(res?.card.sections.join('\n')).not.toContain('npm install')
    expect(res?.card.buttons?.some((b) => b.label.includes('Try docs.plus'))).toBe(true)

    const edited = buildReleaseProjection(
      {
        action: 'edited',
        repository: { full_name: 'docs-plus/docs.plus' },
        release: {
          id: 901,
          tag_name: 'v2.3.6',
          name: 'docs.plus 2.3.6',
          html_url: 'https://github.com/docs-plus/docs.plus/releases/tag/v2.3.6',
          body: 'Updated note.',
          author: { login: 'HMarzban' }
        }
      },
      TEST_CONFIG
    )
    expect(edited?.entityKey).toBe('release:901')
    expect(edited?.card.silent).toBe(true)
    expect(edited?.card.footer).toContain('release.edited')
  })

  it('includes pinned npm install on @docs.plus/* extension releases', () => {
    const res = buildReleaseProjection(
      {
        action: 'prereleased',
        repository: { full_name: 'docs-plus/docs.plus' },
        release: {
          id: 902,
          tag_name: '@docs.plus/extension-hyperlink@4.4.0-rc.1',
          name: '@docs.plus/extension-hyperlink 4.4.0-rc.1',
          html_url: 'https://github.com/docs-plus/docs.plus/releases/tag/ext',
          prerelease: true,
          body: 'Fix mobile dismiss.',
          author: { login: 'HMarzban' }
        }
      },
      TEST_CONFIG
    )
    const body = res?.card.sections.join('\n') ?? ''
    expect(body).toContain('npm install @docs.plus/extension-hyperlink@4.4.0-rc.1')
    expect(body).not.toContain('@next')
    expect(res?.card.buttons?.some((b) => b.label.includes('View on npm'))).toBe(true)
  })
})

describe('PR lifecycle projection', () => {
  it('suppresses drafts until ready, tracks reviews, and builds So far reply timelines', () => {
    const basePr = {
      number: 742,
      title: 'Fix heading fold scroll jump',
      html_url: 'https://github.com/docs-plus/docs.plus/pull/742',
      state: 'open' as const,
      draft: true,
      body: 'Closes #710',
      user: { login: 'alice', type: 'User' },
      author_association: 'FIRST_TIME_CONTRIBUTOR',
      additions: 84,
      deletions: 19,
      changed_files: 3,
      labels: [{ name: 'Editor' }],
      requested_reviewers: [{ login: 'HMarzban' }]
    }

    expect(
      projectPullRequestEvent(
        {
          action: 'opened',
          pull_request: basePr,
          repository: { full_name: 'docs-plus/docs.plus' }
        },
        null,
        TEST_CONFIG
      )
    ).toBeNull()

    const ready = projectPullRequestEvent(
      {
        action: 'ready_for_review',
        pull_request: { ...basePr, draft: false },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      null,
      TEST_CONFIG
    )!
    expect(ready.anchorCard.silent).toBe(false)
    expect(ready.triageCard?.card.mentionUserIds).toEqual(['900000000000000001'])

    const changesReq = projectPullRequestReviewEvent(
      {
        action: 'submitted',
        review: {
          state: 'changes_requested',
          body: 'Guard Safari scrollTop first.',
          html_url: 'https://github.com/docs-plus/docs.plus/pull/742#pullrequestreview-1',
          user: { login: 'HMarzban', type: 'User' }
        },
        pull_request: { ...basePr, draft: false },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      ready.state,
      TEST_CONFIG
    )!
    expect(changesReq.anchorCard.accentColor).toBe(DISCORD_COLORS.AMBER)
    expect(changesReq.replyCard.sections.join('\n')).toContain('**So far:**')
    expect(changesReq.replyCard.sections.join('\n')).toContain('Changes requested')

    const authorReply = projectPrCommentEvent(
      {
        action: 'created',
        issue: {
          number: 742,
          title: basePr.title,
          html_url: basePr.html_url,
          state: 'open',
          user: basePr.user,
          pull_request: {}
        },
        comment: {
          id: 55,
          body: 'Pushed commit 8b3d12c with the Safari check.',
          html_url: 'https://github.com/docs-plus/docs.plus/pull/742#issuecomment-55',
          user: basePr.user,
          author_association: 'FIRST_TIME_CONTRIBUTOR'
        },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      changesReq.state,
      TEST_CONFIG
    )!
    expect(authorReply.replyCard.sections.join('\n')).toContain('Pushed commit 8b3d12c')

    const merged = projectPullRequestEvent(
      {
        action: 'closed',
        pull_request: {
          ...basePr,
          draft: false,
          state: 'closed',
          merged: true,
          merge_commit_sha: 'deadbeef'
        },
        sender: { login: 'HMarzban' },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      authorReply.state,
      TEST_CONFIG
    )!
    expect(merged.anchorCard.accentColor).toBe(DISCORD_COLORS.GREEN)
    expect(merged.replyCard?.stateBadge).toBe('Merged')
    expect(merged.mergedCommitSha).toBe('deadbeef')
  })
})

describe('issue, discussion, and star projections', () => {
  it('transitions issue from Up for grabs to Claimed to Closed and supports claim replies', () => {
    const opened = {
      number: 835,
      title: '[Bug]: Show synced only after confirm',
      html_url: 'https://github.com/docs-plus/docs.plus/issues/835',
      state: 'open' as const,
      user: { login: 'HMarzban', type: 'User' },
      author_association: 'OWNER',
      labels: [{ name: 'bug' }, { name: 'good first issue' }],
      assignees: []
    }

    const labeled = projectIssueMutationEvent(
      {
        action: 'labeled',
        label: { name: 'good first issue' },
        issue: opened,
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      null,
      TEST_CONFIG
    )!
    expect(labeled.anchorCard.accentColor).toBe(DISCORD_COLORS.AMBER)
    expect(labeled.anchorCard.stateBadge).toBe('Up for grabs')
    expect(labeled.anchorCard.title).not.toContain('[Bug]:')

    const claimReply = projectIssueCommentEvent(
      {
        action: 'created',
        issue: opened,
        comment: {
          id: 99,
          body: 'I can reproduce this on Safari and open a PR tonight.',
          html_url: 'https://github.com/docs-plus/docs.plus/issues/835#issuecomment-99',
          user: { login: 'sara', type: 'User' },
          author_association: 'NONE'
        },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      labeled.state,
      TEST_CONFIG
    )!
    expect(claimReply.replyCard.stateBadge).toBe('Claim Comment')
    expect(claimReply.replyCard.sections.join('\n')).toContain('volunteered to claim')

    const assigned = projectIssueMutationEvent(
      {
        action: 'assigned',
        assignee: { login: 'sara' },
        issue: { ...opened, assignees: [{ login: 'sara' }] },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      claimReply.state,
      TEST_CONFIG
    )!
    expect(assigned.anchorCard.stateBadge).toBe('Claimed')
    expect(assigned.anchorCard.accentColor).toBe(DISCORD_COLORS.SKY)

    const closedCard = buildIssueCard(
      { ...assigned.state, state: 'closed', linkedPrNumber: 742 },
      'docs-plus/docs.plus',
      true,
      TEST_CONFIG
    )
    expect(closedCard.accentColor).toBe(DISCORD_COLORS.GREEN)
    expect(closedCard.stateBadge).toBe('Closed · PR #742')
  })

  it('groups 12 triage issues into one batch card', () => {
    const items: IssueBatchItem[] = Array.from({ length: 12 }, (_, idx) => ({
      repo: 'docs-plus/docs.plus',
      action: 'opened',
      number: 827 + idx,
      title: `Task ${idx}`,
      url: `https://github.com/docs-plus/docs.plus/issues/${827 + idx}`,
      author: 'HMarzban',
      actor: 'HMarzban',
      outsider: false,
      labels: idx < 5 ? ['DevOps'] : idx < 9 ? ['Auth'] : ['Chat'],
      assignees: [],
      stateReason: '',
      closedByPr: null
    }))
    const batch = buildTriageBatchCard(items, 'docs-plus/docs.plus')!
    expect(batch.stateBadge).toBe('Triage Batch')
    expect(batch.silent).toBe(true)
    expect(batch.sections[0]).toContain('DevOps (5)')
  })

  it('projects Discussions and Star milestones cleanly', () => {
    const created = projectDiscussionEvent(
      {
        action: 'created',
        discussion: {
          number: 375,
          title: 'Let each person choose toolbar buttons',
          html_url: 'https://github.com/docs-plus/docs.plus/discussions/375',
          user: { login: 'HMarzban', type: 'User' },
          author_association: 'OWNER',
          category: { name: 'Ideas' }
        },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      null
    )!
    expect(created.anchorCard.accentColor).toBe(DISCORD_COLORS.SKY)

    const replied = projectDiscussionCommentEvent(
      {
        action: 'created',
        discussion: {
          number: 375,
          title: 'Let each person choose toolbar buttons',
          html_url: 'https://github.com/docs-plus/docs.plus/discussions/375',
          user: { login: 'HMarzban', type: 'User' }
        },
        comment: {
          body: 'Per-user presets would be great.',
          html_url: 'https://github.com/docs-plus/docs.plus/discussions/375#discussioncomment-1',
          user: { login: 'edsaperia', type: 'User' },
          author_association: 'NONE'
        },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      created.state
    )!
    expect(replied.replyCard.silent).toBe(false)

    const answered = projectDiscussionEvent(
      {
        action: 'answered',
        discussion: {
          number: 375,
          title: 'Let each person choose toolbar buttons',
          html_url: 'https://github.com/docs-plus/docs.plus/discussions/375',
          user: { login: 'HMarzban', type: 'User' },
          answer_chosen_by: { login: 'HMarzban' }
        },
        answer: { body: 'Accepted into roadmap.' },
        repository: { full_name: 'docs-plus/docs.plus' }
      },
      replied.state
    )!
    expect(answered.anchorCard.accentColor).toBe(DISCORD_COLORS.GREEN)
    expect(answered.replyCard?.stateBadge).toBe('Marked Answer')

    const milestone = buildStarCard(
      [
        {
          repo: 'docs-plus/docs.plus',
          login: 'alex-oss',
          avatarUrl: '',
          htmlUrl: '',
          stargazersCount: 100,
          starredAt: 1
        }
      ],
      'docs-plus/docs.plus'
    )!
    expect(milestone.accentColor).toBe(DISCORD_COLORS.GOLD)
    expect(milestone.silent).toBe(false)
    expect(milestone.stateBadge).toContain('100 Stars')
  })
})
