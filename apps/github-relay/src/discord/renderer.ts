import { cleanText, isSafeHttpsUrl, truncateMarkdownSafe } from '../security.ts'
import type {
  CardButton,
  CardModel,
  DiscordActionRowComponent,
  DiscordContainerChild,
  DiscordContainerComponent,
  DiscordLinkButtonComponent,
  DiscordTextDisplayComponent,
  DiscordV2Payload
} from '../types.ts'

export const DISCORD_COLORS = {
  SKY: 0x0ea5e9,
  AMBER: 0xf59e0b,
  VIOLET: 0x8b5cf6,
  GREEN: 0x22c55e,
  GOLD: 0xeab308,
  RED: 0xef4444,
  SLATE: 0x64748b
} as const

export const IS_COMPONENTS_V2_FLAG = 1 << 15 // 32768
export const SUPPRESS_NOTIFICATIONS_FLAG = 1 << 12 // 4096

const MAX_TEXT_TOTAL = 3900
const MAX_COMPONENTS_TOTAL = 40
const SNOWFLAKE_RE = /^\d{17,22}$/

function toLinkButton(btn: CardButton): DiscordLinkButtonComponent | null {
  if (!isSafeHttpsUrl(btn.url)) return null
  const label = cleanText(btn.label).slice(0, 80)
  if (!label) return null
  return {
    type: 2,
    style: 5,
    label,
    url: btn.url.trim()
  }
}

export function countComponents(node: DiscordContainerComponent): number {
  let count = 1
  for (const child of node.components) {
    count += 1
    if (child.type === 9) {
      count += child.components.length + 1
    } else if (child.type === 1) {
      count += child.components.length
    }
  }
  return count
}

export function totalTextLength(node: DiscordContainerComponent): number {
  let total = 0
  for (const child of node.components) {
    if (child.type === 10) {
      total += child.content.length
    } else if (child.type === 9) {
      for (const td of child.components) {
        total += td.content.length
      }
    }
  }
  return total
}

function enforceTextBudget(container: DiscordContainerComponent): void {
  let excess = totalTextLength(container) - MAX_TEXT_TOTAL
  if (excess <= 0) return

  // Shrink body TextDisplay nodes first from longest to shortest so headers and footers survive.
  const bodyDisplays: DiscordTextDisplayComponent[] = []
  for (const child of container.components) {
    if (child.type === 10 && !child.content.startsWith('-# ')) {
      bodyDisplays.push(child)
    }
  }

  bodyDisplays.sort((a, b) => b.content.length - a.content.length)
  for (const td of bodyDisplays) {
    if (excess <= 0) break
    const targetLen = Math.max(40, td.content.length - excess)
    const { text } = truncateMarkdownSafe(td.content, targetLen)
    const saved = td.content.length - text.length
    td.content = text
    excess -= saved
  }
}

export function renderCard(card: CardModel): DiscordV2Payload {
  const children: DiscordContainerChild[] = []

  const badge = cleanText(card.stateBadge)
  const title = cleanText(card.title)
  const headerContent = badge ? `**${badge}**\n### ${title}` : `### ${title}`
  const headerText: DiscordTextDisplayComponent = {
    type: 10,
    content: truncateMarkdownSafe(headerContent, 400).text
  }

  const primaryAccessory = card.primaryButton ? toLinkButton(card.primaryButton) : null
  if (primaryAccessory) {
    children.push({
      type: 9,
      components: [headerText],
      accessory: primaryAccessory
    })
  } else {
    children.push(headerText)
  }

  if (isSafeHttpsUrl(card.bannerImageUrl)) {
    children.push({
      type: 12,
      items: [{ media: { url: card.bannerImageUrl.trim() } }]
    })
  }

  for (const section of card.sections) {
    const trimmed = section.trim()
    if (!trimmed) continue
    children.push({
      type: 10,
      content: truncateMarkdownSafe(trimmed, 3400).text
    })
  }

  const linkButtons: DiscordLinkButtonComponent[] = []
  for (const btn of card.buttons ?? []) {
    const built = toLinkButton(btn)
    if (built) linkButtons.push(built)
    if (linkButtons.length >= 5) break
  }

  if (linkButtons.length > 0) {
    const row: DiscordActionRowComponent = {
      type: 1,
      components: linkButtons
    }
    children.push(row)
  }

  const cleanFooter = cleanText(card.footer)
  if (cleanFooter) {
    children.push({ type: 14, divider: true, spacing: 1 })
    children.push({
      type: 10,
      content: truncateMarkdownSafe(`-# ${cleanFooter}`, 400).text
    })
  }

  const container: DiscordContainerComponent = {
    type: 17,
    ...(card.accentColor !== null ? { accent_color: card.accentColor } : {}),
    components: children
  }

  // Drop extra middle body sections if a card ever nears the 40-component limit.
  while (countComponents(container) > MAX_COMPONENTS_TOTAL && container.components.length > 2) {
    container.components.splice(1, 1)
  }

  enforceTextBudget(container)

  const validMentions = Array.from(
    new Set((card.mentionUserIds ?? []).filter((id) => SNOWFLAKE_RE.test(id)))
  )

  const payload: DiscordV2Payload = {
    flags: card.silent
      ? IS_COMPONENTS_V2_FLAG | SUPPRESS_NOTIFICATIONS_FLAG
      : IS_COMPONENTS_V2_FLAG,
    components: [container],
    allowed_mentions: {
      parse: [],
      ...(validMentions.length > 0 ? { users: validMentions } : {})
    }
  }

  if (card.replyToMessageId && SNOWFLAKE_RE.test(card.replyToMessageId)) {
    payload.message_reference = {
      message_id: card.replyToMessageId,
      fail_if_not_exists: false
    }
  }

  return payload
}
