import type { ChannelQueue } from '../queue/channelQueue.ts'
import { cleanText } from '../security.ts'
import type { SqliteStore } from '../store/sqliteStore.ts'
import type {
  CardModel,
  ChannelKey,
  DiscussionEntityState,
  EntityState,
  EntityType,
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
import { buildIssueCard, projectIssueCommentEvent, projectIssueMutationEvent } from './issue.ts'
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

  private getPrState(entityKey: string): PrEntityState | null {
    const state = this.store.getEntity(entityKey)?.state
    return state?.kind === 'pr' ? state : null
  }

  private getIssueState(entityKey: string): IssueEntityState | null {
    const state = this.store.getEntity(entityKey)?.state
    return state?.kind === 'issue' ? state : null
  }

  private getDiscussionState(entityKey: string): DiscussionEntityState | null {
    const state = this.store.getEntity(entityKey)?.state
    return state?.kind === 'discussion' ? state : null
  }

  private enqueueUpsertEntity(
    channelKey: ChannelKey,
    kind: string,
    entityKey: string,
    entityType: EntityType,
    card: CardModel,
    state: EntityState,
    nowMs: number
  ): void {
    this.store.enqueueEntityUpsert({
      channelKey,
      channelId: this.config.channels[channelKey],
      kind,
      entityKey,
      entityType,
      card,
      state,
      nowMs
    })
  }

  private enqueueReply(
    channelKey: ChannelKey,
    kind: string,
    entityKey: string,
    card: CardModel,
    nowMs: number
  ): void {
    this.store.enqueueJob(
      channelKey,
      kind,
      { op: 'reply_to_entity', entityKey, card },
      { entityKey, nowMs }
    )
  }

  private updateExistingTriagePr(
    entityKey: string,
    kind: string,
    state: PrEntityState,
    repo: string,
    nowMs: number
  ): void {
    if (!this.config.hasDistinctTriageChannel) return
    const triageKey = `triage:${entityKey}`
    if (!this.store.getEntity(triageKey)) return
    this.enqueueUpsertEntity(
      'triage',
      kind,
      triageKey,
      'pr',
      buildPrCard(state, repo, true),
      state,
      nowMs
    )
  }

  private updateExistingTriageIssue(
    entityKey: string,
    kind: string,
    state: IssueEntityState,
    repo: string,
    nowMs: number
  ): void {
    if (!this.config.hasDistinctTriageChannel) return
    const triageKey = `triage:${entityKey}`
    if (!this.store.getEntity(triageKey)) return
    this.enqueueUpsertEntity(
      'triage',
      kind,
      triageKey,
      'issue',
      buildIssueCard(state, repo, true, this.config),
      state,
      nowMs
    )
  }

  private buildIssueBatchItem(
    event: GitHubIssuesEvent,
    action: 'opened' | 'closed',
    nowMs: number
  ): IssueBatchItem {
    const issue = event.issue
    return {
      repo: event.repository.full_name,
      action,
      number: issue.number,
      title: cleanText(issue.title),
      url: issue.html_url,
      author: cleanText(issue.user.login),
      actor: cleanText(event.sender?.login || issue.user.login),
      outsider: isOutsider(issue.author_association),
      labels: (issue.labels ?? []).map((l) => l.name),
      assignees: (issue.assignees ?? []).map((a) => cleanText(a.login)),
      stateReason: issue.state_reason ?? '',
      closedByPr: null,
      receivedAt: nowMs
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
    const entityKey = `pr:${event.pull_request.number}`
    const result = projectPullRequestEvent(event, this.getPrState(entityKey), this.config)
    if (!result) return

    if (result.mergedCommitSha) {
      this.store.recordRecentMerge(result.mergedCommitSha, result.state.number, nowMs)
    }

    this.enqueueUpsertEntity(
      'github',
      `pr.${event.action}`,
      result.entityKey,
      'pr',
      result.anchorCard,
      result.state,
      nowMs
    )

    if (result.replyCard) {
      this.enqueueReply(
        'github',
        `pr.reply.${event.action}`,
        result.entityKey,
        result.replyCard,
        nowMs
      )
    }

    if (result.triageCard) {
      this.enqueueUpsertEntity(
        'triage',
        `triage.pr.${event.action}`,
        result.triageCard.entityKey,
        'pr',
        result.triageCard.card,
        result.triageCard.state,
        nowMs
      )
    } else {
      this.updateExistingTriagePr(
        result.entityKey,
        `triage.pr.${event.action}`,
        result.state,
        event.repository.full_name,
        nowMs
      )
    }
  }

  private handlePullRequestReview(event: GitHubPullRequestReviewEvent, nowMs: number): void {
    const entityKey = `pr:${event.pull_request.number}`
    const result = projectPullRequestReviewEvent(event, this.getPrState(entityKey), this.config)
    if (!result) return

    this.enqueueUpsertEntity(
      'github',
      'pr_review.anchor',
      result.entityKey,
      'pr',
      result.anchorCard,
      result.state,
      nowMs
    )

    this.enqueueReply('github', 'pr_review.reply', result.entityKey, result.replyCard, nowMs)

    if (result.triageCard) {
      this.enqueueUpsertEntity(
        'triage',
        'triage.pr_review',
        result.triageCard.entityKey,
        'pr',
        result.triageCard.card,
        result.triageCard.state,
        nowMs
      )
    } else {
      this.updateExistingTriagePr(
        result.entityKey,
        'triage.pr_review',
        result.state,
        event.repository.full_name,
        nowMs
      )
    }
  }

  private handleIssues(event: GitHubIssuesEvent, nowMs: number): void {
    if (isBotUser(event.issue.user)) return
    const action = event.action
    const issue = event.issue
    const repo = event.repository.full_name
    const entityKey = `issue:${issue.number}`

    if (action === 'opened') {
      this.queue.addIssueOpenItem(this.buildIssueBatchItem(event, 'opened', nowMs), nowMs)
      return
    }

    if (action === 'closed') {
      this.queue.addIssueCloseItem(this.buildIssueBatchItem(event, 'closed', nowMs), nowMs)
      return
    }

    // Merge creation-time label/assign events into a pending issue_open batch if present.
    if (
      (action === 'labeled' || action === 'assigned') &&
      this.queue.mergePendingIssueOpen(issue)
    ) {
      return
    }

    const mutation = projectIssueMutationEvent(event, this.getIssueState(entityKey), this.config)
    if (!mutation) return

    this.enqueueUpsertEntity(
      'github',
      `issue.${action}`,
      mutation.entityKey,
      'issue',
      mutation.anchorCard,
      mutation.state,
      nowMs
    )

    if (mutation.triageCard) {
      this.enqueueUpsertEntity(
        'triage',
        `triage.issue.${action}`,
        `triage:${mutation.entityKey}`,
        'issue',
        mutation.triageCard,
        mutation.state,
        nowMs
      )
    } else {
      this.updateExistingTriageIssue(
        mutation.entityKey,
        `triage.issue.${action}`,
        mutation.state,
        repo,
        nowMs
      )
    }
  }

  private handleIssueComment(event: GitHubIssueCommentEvent, nowMs: number): void {
    if (event.issue.pull_request) {
      const entityKey = `pr:${event.issue.number}`
      const prComment = projectPrCommentEvent(event, this.getPrState(entityKey), this.config)
      if (!prComment) return

      this.enqueueUpsertEntity(
        'github',
        'pr_comment.anchor',
        prComment.entityKey,
        'pr',
        prComment.anchorCard,
        prComment.state,
        nowMs
      )
      this.enqueueReply(
        'github',
        'pr_comment.reply',
        prComment.entityKey,
        prComment.replyCard,
        nowMs
      )
      this.updateExistingTriagePr(
        prComment.entityKey,
        'triage.pr_comment.anchor',
        prComment.state,
        event.repository.full_name,
        nowMs
      )
      if (prComment.triageReplyCard) {
        this.enqueueReply(
          'triage',
          'triage.pr_comment',
          `triage:${prComment.entityKey}`,
          prComment.triageReplyCard,
          nowMs
        )
      }
      return
    }

    const entityKey = `issue:${event.issue.number}`
    const issueComment = projectIssueCommentEvent(event, this.getIssueState(entityKey), this.config)
    if (!issueComment) return

    this.enqueueUpsertEntity(
      'github',
      'issue_comment.anchor',
      issueComment.entityKey,
      'issue',
      issueComment.anchorCard,
      issueComment.state,
      nowMs
    )
    this.enqueueReply(
      'github',
      'issue_comment.reply',
      issueComment.entityKey,
      issueComment.replyCard,
      nowMs
    )
    this.updateExistingTriageIssue(
      issueComment.entityKey,
      'triage.issue_comment.anchor',
      issueComment.state,
      event.repository.full_name,
      nowMs
    )
    if (issueComment.triageReplyCard) {
      this.enqueueReply(
        'triage',
        'triage.issue_comment',
        `triage:${issueComment.entityKey}`,
        issueComment.triageReplyCard,
        nowMs
      )
    }
  }

  private handleDiscussion(event: GitHubDiscussionEvent, nowMs: number): void {
    const entityKey = `discussion:${event.discussion.number}`
    const result = projectDiscussionEvent(event, this.getDiscussionState(entityKey))
    if (!result) return

    this.enqueueUpsertEntity(
      'github',
      `discussion.${event.action}`,
      result.entityKey,
      'discussion',
      result.anchorCard,
      result.state,
      nowMs
    )

    if (result.replyCard) {
      this.enqueueReply('github', 'discussion.answer', result.entityKey, result.replyCard, nowMs)
    }
  }

  private handleDiscussionComment(event: GitHubDiscussionCommentEvent, nowMs: number): void {
    const entityKey = `discussion:${event.discussion.number}`
    const result = projectDiscussionCommentEvent(event, this.getDiscussionState(entityKey))
    if (!result) return

    this.enqueueUpsertEntity(
      'github',
      'discussion_comment.anchor',
      result.entityKey,
      'discussion',
      result.anchorCard,
      result.state,
      nowMs
    )

    this.enqueueReply(
      'github',
      'discussion_comment.reply',
      result.entityKey,
      result.replyCard,
      nowMs
    )
  }

  private handleRelease(event: GitHubReleaseEvent, nowMs: number): void {
    const projection = buildReleaseProjection(event, this.config)
    if (!projection) return

    this.enqueueUpsertEntity(
      'releases',
      `release.${event.action}`,
      projection.entityKey,
      'release',
      projection.card,
      projection.state,
      nowMs
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
      this.enqueueUpsertEntity(
        'github',
        'workflow_run.ci_update',
        entityKey,
        'pr',
        card,
        updatedState,
        nowMs
      )
      this.updateExistingTriagePr(
        entityKey,
        'triage.workflow_run.ci_update',
        updatedState,
        event.repository.full_name,
        nowMs
      )
    }
  }
}
