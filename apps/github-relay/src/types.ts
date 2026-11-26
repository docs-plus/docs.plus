export type ChannelKey = 'github' | 'triage' | 'releases'

export type EntityType = 'pr' | 'issue' | 'discussion' | 'release'

export type Urgency = 'loud' | 'silent'

export interface DiscordTextDisplayComponent {
  type: 10
  content: string
}

export interface DiscordLinkButtonComponent {
  type: 2
  style: 5
  label: string
  url: string
}

export interface DiscordThumbnailComponent {
  type: 11
  media: { url: string }
  description?: string
}

export interface DiscordSectionComponent {
  type: 9
  components: DiscordTextDisplayComponent[]
  accessory: DiscordLinkButtonComponent | DiscordThumbnailComponent
}

export interface DiscordSeparatorComponent {
  type: 14
  divider?: boolean
  spacing?: 1 | 2
}

export interface DiscordActionRowComponent {
  type: 1
  components: DiscordLinkButtonComponent[]
}

export interface DiscordMediaGalleryComponent {
  type: 12
  items: Array<{
    media: { url: string }
    description?: string
  }>
}

export type DiscordContainerChild =
  | DiscordSectionComponent
  | DiscordTextDisplayComponent
  | DiscordSeparatorComponent
  | DiscordActionRowComponent
  | DiscordMediaGalleryComponent

export interface DiscordContainerComponent {
  type: 17
  accent_color?: number
  components: DiscordContainerChild[]
}

export interface DiscordV2Payload {
  flags: number
  components: [DiscordContainerComponent]
  allowed_mentions: {
    parse: []
    users?: string[]
  }
  message_reference?: {
    message_id: string
    fail_if_not_exists: false
  }
}

export interface CardButton {
  label: string
  url: string
}

export interface CardModel {
  accentColor: number | null
  stateBadge: string
  title: string
  primaryButton?: CardButton
  sections: string[]
  buttons?: CardButton[]
  footer: string
  silent: boolean
  mentionUserIds?: string[]
  replyToMessageId?: string
  bannerImageUrl?: string | null
}

export interface PrEntityState {
  kind: 'pr'
  number: number
  title: string
  url: string
  author: string
  outsider: boolean
  draft: boolean
  merged: boolean
  closed: boolean
  additions: number
  deletions: number
  changedFiles: number
  labels: string[]
  linkedIssues: number[]
  reviewers: Record<string, 'pending' | 'approved' | 'changes_requested'>
  ciStatus: 'unknown' | 'pending' | 'passed' | 'failed'
  commentCount: number
  waitingOn: string
  timeline: string[]
}

export interface IssueEntityState {
  kind: 'issue'
  number: number
  title: string
  url: string
  author: string
  outsider: boolean
  state: 'open' | 'closed'
  stateReason: string
  labels: string[]
  assignees: string[]
  commentCount: number
  linkedPrNumber: number | null
  timeline: string[]
}

export interface DiscussionEntityState {
  kind: 'discussion'
  number: number
  title: string
  url: string
  author: string
  outsider: boolean
  category: string
  answered: boolean
  answeredBy: string | null
  closed: boolean
  commentCount: number
  timeline: string[]
}

export interface ReleaseEntityState {
  kind: 'release'
  id: number
  tagName: string
  name: string
  url: string
  author: string
  prerelease: boolean
  publishedAt: string
  body: string
}

export type EntityState =
  PrEntityState | IssueEntityState | DiscussionEntityState | ReleaseEntityState

export interface EntityRecord {
  entityKey: string
  entityType: EntityType
  channelKey: ChannelKey
  channelId: string
  anchorMessageId: string
  state: EntityState
  timeline: string[]
  updatedAt: number
}

export type QueueJobPayload =
  | {
      op: 'post'
      card: CardModel
    }
  | {
      op: 'upsert_entity'
      entityKey: string
      entityType: EntityType
      card: CardModel
      state: EntityState
      timeline: string[]
      forceNew?: boolean
    }
  | {
      op: 'reply_to_entity'
      entityKey: string
      card: CardModel
      fallbackAnchor?: {
        entityType: EntityType
        card: CardModel
        state: EntityState
        timeline: string[]
      }
    }

export interface QueueJobRecord {
  id: number
  channelKey: ChannelKey
  kind: string
  entityKey: string | null
  payload: QueueJobPayload
  availableAt: number
  attempts: number
  createdAt: number
}

export interface PushBatchItem {
  repo: string
  ref: string
  before: string
  after: string
  compareUrl: string
  pusher: string
  commits: Array<{ id: string; message: string; author: string }>
  closedIssues: number[]
}

export interface IssueBatchItem {
  repo: string
  action: 'opened' | 'closed'
  number: number
  title: string
  url: string
  author: string
  actor: string
  outsider: boolean
  labels: string[]
  assignees: string[]
  stateReason: string
  closedByPr: number | null
}

export interface StarBatchItem {
  repo: string
  login: string
  avatarUrl: string
  htmlUrl: string
  stargazersCount: number
  starredAt: number
}

export type BatchKind = 'push' | 'issue_open' | 'issue_close' | 'star'

export interface PendingBatchRecord<T = unknown> {
  batchKey: string
  channelKey: ChannelKey
  kind: BatchKind
  items: T[]
  flushAt: number
  updatedAt: number
}

export interface GitHubUser {
  login: string
  type?: string
  avatar_url?: string
  html_url?: string
}

export interface GitHubLabel {
  name: string
}

export interface GitHubPushCommit {
  id: string
  message: string
  author?: { name?: string; username?: string }
}

export interface GitHubPushEvent {
  ref: string
  before: string
  after: string
  compare?: string
  pusher?: { name?: string }
  sender?: GitHubUser
  repository: { full_name: string; default_branch?: string }
  commits?: GitHubPushCommit[]
}

export interface GitHubPullRequest {
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  draft?: boolean
  merged?: boolean
  merge_commit_sha?: string | null
  body?: string | null
  user: GitHubUser
  author_association?: string
  labels?: GitHubLabel[]
  assignees?: GitHubUser[]
  requested_reviewers?: GitHubUser[]
  additions?: number
  deletions?: number
  changed_files?: number
}

export interface GitHubPullRequestEvent {
  action: string
  pull_request: GitHubPullRequest
  requested_reviewer?: GitHubUser
  sender?: GitHubUser
  repository: { full_name: string }
}

export interface GitHubPullRequestReviewEvent {
  action: string
  review: {
    state: string
    body?: string | null
    html_url?: string
    user: GitHubUser
  }
  pull_request: GitHubPullRequest
  sender?: GitHubUser
  repository: { full_name: string }
}

export interface GitHubIssue {
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  state_reason?: string | null
  body?: string | null
  user: GitHubUser
  author_association?: string
  labels?: GitHubLabel[]
  assignees?: GitHubUser[]
  pull_request?: unknown
}

export interface GitHubIssuesEvent {
  action: string
  issue: GitHubIssue
  label?: GitHubLabel
  assignee?: GitHubUser
  sender?: GitHubUser
  repository: { full_name: string }
}

export interface GitHubIssueCommentEvent {
  action: string
  issue: GitHubIssue
  comment: {
    id: number
    body?: string | null
    html_url: string
    user: GitHubUser
    author_association?: string
  }
  sender?: GitHubUser
  repository: { full_name: string }
}

export interface GitHubDiscussion {
  number: number
  title: string
  html_url: string
  body?: string | null
  user: GitHubUser
  author_association?: string
  category?: { name: string }
  answer_chosen_at?: string | null
  answer_chosen_by?: GitHubUser | null
  comments?: number
}

export interface GitHubDiscussionEvent {
  action: string
  discussion: GitHubDiscussion
  answer?: {
    body?: string | null
    html_url?: string
    user?: GitHubUser
  }
  sender?: GitHubUser
  repository: { full_name: string }
}

export interface GitHubDiscussionCommentEvent {
  action: string
  discussion: GitHubDiscussion
  comment: {
    body?: string | null
    html_url: string
    user: GitHubUser
    author_association?: string
  }
  sender?: GitHubUser
  repository: { full_name: string }
}

export interface GitHubReleaseEvent {
  action: string
  release: {
    id: number
    tag_name: string
    name?: string | null
    html_url: string
    body?: string | null
    prerelease?: boolean
    draft?: boolean
    published_at?: string
    author?: GitHubUser
  }
  sender?: GitHubUser
  repository: { full_name: string }
}

export interface GitHubStarEvent {
  action: string
  starred_at?: string | null
  sender: GitHubUser
  repository: { full_name: string; stargazers_count?: number }
}

export interface GitHubWorkflowRunEvent {
  action: string
  workflow_run: {
    name?: string
    conclusion?: string | null
    status?: string
    head_branch?: string
    html_url?: string
    pull_requests?: Array<{ number: number }>
  }
  repository: { full_name: string }
}

export type DigestKind = 'daily' | 'biweekly' | 'monthly'

export interface DigestSnapshot {
  repo: string
  nowMs: number
  starsCount: number
  awaitingReviewPrs: Array<{
    number: number
    title: string
    url: string
    ageHours: number
    ciStatus: 'passed' | 'failed' | 'pending' | 'unknown'
    waitingOn: string
  }>
  unansweredExternalIssues: Array<{
    number: number
    title: string
    url: string
    author: string
    ageHours: number
    kind: 'issue' | 'discussion'
  }>
  staleClaimedIssues: Array<{
    number: number
    title: string
    url: string
    assignee: string
    ageDays: number
  }>
  dependabotOpenPrs: number[]
  featuredClaimableIssues: Array<{
    number: number
    title: string
    url: string
    labels: string[]
  }>
}

export interface PeriodReportSnapshot {
  kind: 'biweekly' | 'monthly'
  repo: string
  periodLabel: string
  sinceMs: number
  untilMs: number
  starsCount: number
  commitsCount: number
  commitsCapped: boolean
  releases: Array<{
    tagName: string
    name: string
    url: string
    prerelease: boolean
  }>
  mergedPrsCount: number
  closedIssuesCount: number
  contributors: string[]
  featuredClaimableIssues: Array<{
    number: number
    title: string
    url: string
    labels: string[]
  }>
}

export interface RelayConfig {
  port: number
  sqlitePath: string
  githubRepository: string
  githubWebhookSecret: string
  githubToken: string | null
  discordBotToken: string
  channels: Record<ChannelKey, string>
  hasDistinctTriageChannel: boolean
  discordUsers: Record<string, string>
  relayAdminToken: string | null
  pushCoalesceMs: number
  issueOpenCoalesceMs: number
  triageBurstWindowMs: number
  starBurstWindowMs: number
  digestEnabled: boolean
  dailyDigestHourUtc: number
  biweeklyReportDayUtc: number
  biweeklyReportHourUtc: number
  monthlyReportDayUtc: number
  monthlyReportHourUtc: number
  appUrl: string
  selfHostDocsUrl: string
}

export interface DiscordTransport {
  sendMessage(channelId: string, payload: DiscordV2Payload): Promise<{ id: string }>
  editMessage(
    channelId: string,
    messageId: string,
    payload: DiscordV2Payload
  ): Promise<{ id: string } | { notFound: true }>
}
