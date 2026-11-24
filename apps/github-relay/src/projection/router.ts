import { DISCORD_COLORS } from '../discord/renderer.ts'
import type { ChannelQueue } from '../queue/channelQueue.ts'
import { cleanText } from '../security.ts'
import type { SqliteStore } from '../store/sqliteStore.ts'
import type {
  DiscussionEntityState,
  GitHubDiscussionCommentEvent,
  GitHubDiscussionEvent,
  GitHubIssueCommentEvent,
  GitHubIssuesEvent,
  GitHubPullRequestEvent,
  GitHubPullRequestReviewEvent,
  GitHubPushEvent,
  GitHubReleaseEvent,
  GitHubStarEvent,
  GitHubWorkflowRunEvent,
  IssueBatchItem,
  IssueEntityState,
  PrEntityState,
  PushBatchItem,
  RelayConfig,
  StarBatchItem
} from '../types.ts'
import { projectDiscussionCommentEvent, projectDiscussionEvent } from './discussion.ts'
import { extractLinkedIssues, isBotUser, isOutsider } from './helpers.ts'
import {
  buildIssueCard,
  buildIssueStateFromPayload,
  isSpecialIssue,
  projectIssueCommentEvent,
  projectIssueMutationEvent
} from './issue.ts'
import {
  buildPrCard,
  projectPrCommentEvent,
  projectPullRequestEvent,
  projectPullRequestReviewEvent
} from './pullRequest.ts'
import { buildReleaseProjection } from './release.ts'

export class WebhookRouter {
  private readonly config: RelayConfig
  private readonly store: SqliteStore
  private readonly queue: ChannelQueue

  constructor(config: RelayConfig, store: SqliteStore, queue: ChannelQueue) {
    this.config = config
    this.store = store
    this.queue = queue
  }

  route(eventName: string, payload: unknown, nowMs = Date.now()): void {
    switch (eventName) {
      case 'push':
        this.handlePush(payload as GitHubPushEvent, nowMs)
        break
      case 'pull_request':
        this.handlePullRequest(payload as GitHubPullRequestEvent, nowMs)
        break
      case 'pull_request_review':
        this.handlePullRequestReview(payload as GitHubPullRequestReviewEvent, nowMs)
        break
      case 'issues':
        this.handleIssues(payload as GitHubIssuesEvent, nowMs)
        break
      case 'issue_comment':
        this.handleIssueComment(payload as GitHubIssueCommentEvent, nowMs)
        break
      case 'discussion':
        this.handleDiscussion(payload as GitHubDiscussionEvent, nowMs)
        break
      case 'discussion_comment':
        this.handleDiscussionComment(payload as GitHubDiscussionCommentEvent, nowMs)
        break
      case 'release':
        this.handleRelease(payload as GitHubReleaseEvent, nowMs)
        break
      case 'star':
        this.handleStar(payload as GitHubStarEvent, nowMs)
        break
      case 'workflow_run':
        this.handleWorkflowRun(payload as GitHubWorkflowRunEvent, nowMs)
        break
      default:
        break
    }
  }

  private handlePush(event: GitHubPushEvent, nowMs: number): void {
    if (isBotUser(event.sender)) return
    const defaultBranch = event.repository.default_branch || 'main'
    if (event.ref !== `refs/heads/${defaultBranch}`) return
    if (event.after === '0000000000000000000000000000000000000000') return

    const commits = (event.commits ?? []).map((c) => ({
      id: c.id,
      message: c.message,
      author: c.author?.username || c.author?.name || event.pusher?.name || 'unknown'
    }))
    if (commits.length === 0) return

    const closedIssues = commits.flatMap((c) => extractLinkedIssues(c.message))
    const item: PushBatchItem = {
      repo: event.repository.full_name,
      ref: event.ref,
      before: event.before,
      after: event.after,
      compareUrl: event.compare ?? '',
      pusher: event.sender?.login || event.pusher?.name || 'unknown',
      commits,
      closedIssues
    }
    this.queue.addPushItem(item, nowMs)
  }

  private handlePullRequest(event: GitHubPullRequestEvent, nowMs: number): void {
    if (isBotUser(event.sender)) return
    const entityKey = `pr:${event.pull_request.number}`
    const existing = this.store.getEntity(entityKey)?.state as PrEntityState | undefined
    const result = projectPullRequestEvent(event, existing ?? null, this.config)
    if (!result) return

    if (result.mergedCommitSha) {
      this.store.recordRecentMerge(result.mergedCommitSha, result.state.number, nowMs)
    }

    this.store.enqueueJob(
      'github',
      `pr.${event.action}`,
      {
        op: 'upsert_entity',
        entityKey: result.entityKey,
        entityType: 'pr',
        card: result.anchorCard,
        state: result.state,
        timeline: result.state.timeline
      },
      { entityKey: result.entityKey, nowMs }
    )

    if (result.replyCard) {
      this.store.enqueueJob(
        'github',
        `pr.reply.${event.action}`,
        {
          op: 'reply_to_entity',
          entityKey: result.entityKey,
          card: result.replyCard
        },
        { entityKey: result.entityKey, nowMs }
      )
    }

    if (result.triageCard) {
      this.store.enqueueJob(
        'triage',
        `triage.pr.${event.action}`,
        {
          op: 'upsert_entity',
          entityKey: result.triageCard.entityKey,
          entityType: 'pr',
          card: result.triageCard.card,
          state: result.triageCard.state,
          timeline: result.triageCard.state.timeline
        },
        { entityKey: result.triageCard.entityKey, nowMs }
      )
    }
  }

  private handlePullRequestReview(event: GitHubPullRequestReviewEvent, nowMs: number): void {
    const entityKey = `pr:${event.pull_request.number}`
    const existing = this.store.getEntity(entityKey)?.state as PrEntityState | undefined
    const result = projectPullRequestReviewEvent(event, existing ?? null, this.config)
    if (!result) return

    this.store.enqueueJob(
      'github',
      'pr_review.anchor',
      {
        op: 'upsert_entity',
        entityKey: result.entityKey,
        entityType: 'pr',
        card: result.anchorCard,
        state: result.state,
        timeline: result.state.timeline
      },
      { entityKey: result.entityKey, nowMs }
    )

    this.store.enqueueJob(
      'github',
      'pr_review.reply',
      {
        op: 'reply_to_entity',
        entityKey: result.entityKey,
        card: result.replyCard
      },
      { entityKey: result.entityKey, nowMs }
    )

    if (result.triageCard) {
      this.store.enqueueJob(
        'triage',
        'triage.pr_review',
        {
          op: 'upsert_entity',
          entityKey: result.triageCard.entityKey,
          entityType: 'pr',
          card: result.triageCard.card,
          state: result.triageCard.state,
          timeline: result.triageCard.state.timeline
        },
        { entityKey: result.triageCard.entityKey, nowMs }
      )
    }
  }

  private handleIssues(event: GitHubIssuesEvent, nowMs: number): void {
    if (isBotUser(event.sender) || isBotUser(event.issue.user)) return
    const action = event.action
    const issue = event.issue
    const repo = event.repository.full_name
    const labels = (issue.labels ?? []).map((l) => l.name)
    const outsider = isOutsider(issue.author_association)
    const entityKey = `issue:${issue.number}`

    if (action === 'opened') {
      const item: IssueBatchItem = {
        repo,
        action: 'opened',
        number: issue.number,
        title: cleanText(issue.title),
        url: issue.html_url,
        author: cleanText(issue.user.login),
        actor: cleanText(event.sender?.login || issue.user.login),
        outsider,
        labels,
        assignees: (issue.assignees ?? []).map((a) => cleanText(a.login)),
        stateReason: issue.state_reason ?? '',
        closedByPr: null
      }
      this.queue.addIssueOpenItem(item, nowMs)
      return
    }

    if (action === 'closed') {
      const item: IssueBatchItem = {
        repo,
        action: 'closed',
        number: issue.number,
        title: cleanText(issue.title),
        url: issue.html_url,
        author: cleanText(issue.user.login),
        actor: cleanText(event.sender?.login || issue.user.login),
        outsider,
        labels,
        assignees: (issue.assignees ?? []).map((a) => cleanText(a.login)),
        stateReason: issue.state_reason ?? '',
        closedByPr: null
      }
      this.queue.addIssueCloseItem(item, nowMs)
      return
    }

    // Merge creation-time label/assign events into a pending issue_open batch if present.
    if (
      (action === 'labeled' || action === 'assigned') &&
      this.queue.mergePendingIssueOpen(issue)
    ) {
      return
    }

    const existing = this.store.getEntity(entityKey)?.state as IssueEntityState | undefined
    const mutation = projectIssueMutationEvent(event, existing ?? null, this.config)
    if (!mutation) return

    this.store.enqueueJob(
      'github',
      `issue.${action}`,
      {
        op: 'upsert_entity',
        entityKey: mutation.entityKey,
        entityType: 'issue',
        card: mutation.anchorCard,
        state: mutation.state,
        timeline: mutation.state.timeline
      },
      { entityKey: mutation.entityKey, nowMs }
    )

    if (mutation.triageCard) {
      this.store.enqueueJob(
        'triage',
        `triage.issue.${action}`,
        {
          op: 'upsert_entity',
          entityKey: `triage:${mutation.entityKey}`,
          entityType: 'issue',
          card: mutation.triageCard,
          state: mutation.state,
          timeline: mutation.state.timeline
        },
        { entityKey: `triage:${mutation.entityKey}`, nowMs }
      )
    }
  }

  private handleIssueComment(event: GitHubIssueCommentEvent, nowMs: number): void {
    if (event.issue.pull_request) {
      const entityKey = `pr:${event.issue.number}`
      const existing = this.store.getEntity(entityKey)?.state as PrEntityState | undefined
      const prComment = projectPrCommentEvent(event, existing ?? null, this.config)
      if (!prComment) return

      this.store.enqueueJob(
        'github',
        'pr_comment.anchor',
        {
          op: 'upsert_entity',
          entityKey: prComment.entityKey,
          entityType: 'pr',
          card: prComment.anchorCard,
          state: prComment.state,
          timeline: prComment.state.timeline
        },
        { entityKey: prComment.entityKey, nowMs }
      )
      this.store.enqueueJob(
        'github',
        'pr_comment.reply',
        {
          op: 'reply_to_entity',
          entityKey: prComment.entityKey,
          card: prComment.replyCard
        },
        { entityKey: prComment.entityKey, nowMs }
      )
      if (prComment.triageReplyCard) {
        this.store.enqueueJob(
          'triage',
          'triage.pr_comment',
          {
            op: 'reply_to_entity',
            entityKey: `triage:${prComment.entityKey}`,
            card: prComment.triageReplyCard
          },
          { entityKey: `triage:${prComment.entityKey}`, nowMs }
        )
      }
      return
    }

    const entityKey = `issue:${event.issue.number}`
    const existing = this.store.getEntity(entityKey)?.state as IssueEntityState | undefined
    const issueComment = projectIssueCommentEvent(event, existing ?? null, this.config)
    if (!issueComment) return

    const fallbackState = buildIssueStateFromPayload(event.issue, existing ?? null, 'Opened')
    const fallbackCard = buildIssueCard(
      fallbackState,
      event.repository.full_name,
      !isSpecialIssue(fallbackState.labels, fallbackState.outsider),
      this.config
    )

    this.store.enqueueJob(
      'github',
      'issue_comment.anchor',
      {
        op: 'upsert_entity',
        entityKey: issueComment.entityKey,
        entityType: 'issue',
        card: issueComment.anchorCard,
        state: issueComment.state,
        timeline: issueComment.state.timeline
      },
      { entityKey: issueComment.entityKey, nowMs }
    )
    this.store.enqueueJob(
      'github',
      'issue_comment.reply',
      {
        op: 'reply_to_entity',
        entityKey: issueComment.entityKey,
        card: issueComment.replyCard,
        fallbackAnchor: {
          entityType: 'issue',
          card: fallbackCard,
          state: fallbackState,
          timeline: fallbackState.timeline
        }
      },
      { entityKey: issueComment.entityKey, nowMs }
    )
    if (issueComment.triageReplyCard) {
      this.store.enqueueJob(
        'triage',
        'triage.issue_comment',
        {
          op: 'reply_to_entity',
          entityKey: `triage:${issueComment.entityKey}`,
          card: issueComment.triageReplyCard
        },
        { entityKey: `triage:${issueComment.entityKey}`, nowMs }
      )
    }
  }

  private handleDiscussion(event: GitHubDiscussionEvent, nowMs: number): void {
    const entityKey = `discussion:${event.discussion.number}`
    const existing = this.store.getEntity(entityKey)?.state as DiscussionEntityState | undefined
    const result = projectDiscussionEvent(event, existing ?? null)
    if (!result) return

    this.store.enqueueJob(
      'github',
      `discussion.${event.action}`,
      {
        op: 'upsert_entity',
        entityKey: result.entityKey,
        entityType: 'discussion',
        card: result.anchorCard,
        state: result.state,
        timeline: result.state.timeline
      },
      { entityKey: result.entityKey, nowMs }
    )

    if (result.replyCard) {
      this.store.enqueueJob(
        'github',
        'discussion.answer',
        {
          op: 'reply_to_entity',
          entityKey: result.entityKey,
          card: result.replyCard
        },
        { entityKey: result.entityKey, nowMs }
      )
    }
  }

  private handleDiscussionComment(event: GitHubDiscussionCommentEvent, nowMs: number): void {
    const entityKey = `discussion:${event.discussion.number}`
    const existing = this.store.getEntity(entityKey)?.state as DiscussionEntityState | undefined
    const result = projectDiscussionCommentEvent(event, existing ?? null)
    if (!result) return

    this.store.enqueueJob(
      'github',
      'discussion_comment.anchor',
      {
        op: 'upsert_entity',
        entityKey: result.entityKey,
        entityType: 'discussion',
        card: result.anchorCard,
        state: result.state,
        timeline: result.state.timeline
      },
      { entityKey: result.entityKey, nowMs }
    )

    this.store.enqueueJob(
      'github',
      'discussion_comment.reply',
      {
        op: 'reply_to_entity',
        entityKey: result.entityKey,
        card: result.replyCard
      },
      { entityKey: result.entityKey, nowMs }
    )
  }

  private handleRelease(event: GitHubReleaseEvent, nowMs: number): void {
    const projection = buildReleaseProjection(event, this.config)
    if (!projection) return

    this.store.enqueueJob(
      'releases',
      `release.${event.action}`,
      {
        op: 'upsert_entity',
        entityKey: projection.entityKey,
        entityType: 'release',
        card: projection.card,
        state: projection.state,
        timeline: [event.action]
      },
      { entityKey: projection.entityKey, nowMs }
    )
  }

  private handleStar(event: GitHubStarEvent, nowMs: number): void {
    if (event.action !== 'created') return
    if (isBotUser(event.sender)) return

    const item: StarBatchItem = {
      repo: event.repository.full_name,
      login: cleanText(event.sender.login),
      avatarUrl: event.sender.avatar_url ?? '',
      htmlUrl: event.sender.html_url ?? '',
      stargazersCount: event.repository.stargazers_count ?? 0,
      starredAt: nowMs
    }
    this.queue.addStarItem(item, nowMs)
  }

  private handleWorkflowRun(event: GitHubWorkflowRunEvent, nowMs: number): void {
    if (event.action !== 'completed') return
    const prs = event.workflow_run.pull_requests ?? []
    if (prs.length === 0) return

    const conclusion = event.workflow_run.conclusion
    const ciStatus: PrEntityState['ciStatus'] =
      conclusion === 'success'
        ? 'passed'
        : conclusion === 'failure' || conclusion === 'timed_out'
          ? 'failed'
          : 'unknown'
    if (ciStatus === 'unknown') return

    for (const prRef of prs) {
      const entityKey = `pr:${prRef.number}`
      const record = this.store.getEntity(entityKey)
      if (!record || record.state.kind !== 'pr') continue
      const updatedState: PrEntityState = {
        ...record.state,
        ciStatus,
        timeline: [...record.state.timeline]
      }
      if (ciStatus === 'passed' && !updatedState.timeline.includes('CI passed')) {
        updatedState.timeline.push('CI passed')
      } else if (ciStatus === 'failed' && !updatedState.timeline.includes('CI failed')) {
        updatedState.timeline.push('CI failed')
      }

      const card = buildPrCard(updatedState, event.repository.full_name, true)
      if (ciStatus === 'failed') {
        card.accentColor = DISCORD_COLORS.RED
      }
      this.store.enqueueJob(
        'github',
        'workflow_run.ci_update',
        {
          op: 'upsert_entity',
          entityKey,
          entityType: 'pr',
          card,
          state: updatedState,
          timeline: updatedState.timeline
        },
        { entityKey, nowMs }
      )
    }
  }
}
