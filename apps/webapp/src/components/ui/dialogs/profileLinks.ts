import type { LinkItem } from '@types'

type RawLink = Partial<LinkItem> & {
  metadata?: Partial<LinkItem['metadata']>
}

export type SanitizedProfileLink = {
  key: string
  url: string
  type: LinkItem['type'] | string
  title: string
  description?: string
}

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export function sanitizeProfileLinks(rawLinks: unknown): SanitizedProfileLink[] {
  if (!Array.isArray(rawLinks)) return []

  return rawLinks.reduce<SanitizedProfileLink[]>((acc, current, index) => {
    if (!current || typeof current !== 'object') return acc

    const link = current as RawLink
    const url = isNonEmptyString(link.url) ? link.url.trim() : ''
    if (!url) return acc

    const type = isNonEmptyString(link.type) ? link.type.trim() : 'simple'
    const metadata =
      link.metadata && typeof link.metadata === 'object'
        ? link.metadata
        : ({} as Partial<LinkItem['metadata']>)

    acc.push({
      key: `${url}-${index}`,
      url,
      type,
      title: isNonEmptyString(metadata?.title) ? metadata.title.trim() : url,
      description: isNonEmptyString(metadata?.description) ? metadata.description.trim() : undefined
    })

    return acc
  }, [])
}

export function profileLinkAnchorProps(link: SanitizedProfileLink): {
  href: string
  target?: '_blank'
  rel?: 'noopener noreferrer'
} {
  const href =
    link.type === 'email'
      ? `mailto:${link.url}`
      : link.type === 'phone'
        ? `tel:${link.url}`
        : link.url

  if (link.type === 'social' || link.type === 'simple') {
    return { href, target: '_blank', rel: 'noopener noreferrer' }
  }

  return { href }
}
