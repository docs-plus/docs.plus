import { Icons } from '@components/icons/registry'
import { parseHistoryHash } from '@components/pages/history/historyShareUrl'
import { isReservedSlug, padUrlCore } from '@docs.plus/pad-url'
import type { Editor } from '@tiptap/core'
import type { PadFacets } from '@types'
import { headingAncestry } from '@utils/headingSlugTrail'
import { isWebHref } from '@utils/link-helpers'
import type { IconType } from 'react-icons'

import type { InternalDocumentLink, InternalLinkDescriptor, LinkDestination } from './types'

// Side-effectful execution lives in `internalDocumentLinkActions.ts`; this
// module stays import-light so `classify` is testable without the app's
// store/Supabase graph.

export const INTERNAL_KIND_ICON: Record<InternalDocumentLink['kind'], IconType> = {
  document: Icons.fileText,
  heading: Icons.heading,
  chat: Icons.chatroom,
  filter: Icons.filter,
  history: Icons.history
}

export const INTERNAL_KIND_NAME: Record<InternalDocumentLink['kind'], string> = {
  document: 'This document',
  heading: 'Heading',
  chat: 'Chat',
  filter: 'Filtered view',
  history: 'Version history'
}

/**
 * The one place in a pad an address names: the History hash, else `padUrlCore.place`.
 * `href` is what a filter link opens.
 */
export function classifyPadFacets(pad: PadFacets, href = pad.path): InternalDocumentLink {
  const history = parseHistoryHash(pad.hash)
  if (history.isHistory) return { kind: 'history', version: history.version }
  const place = padUrlCore.place(pad)
  return place.kind === 'filter' ? { ...place, href } : place
}

/**
 * Resolves to an in-document destination, or `null` for external. The doc-slug
 * match is exact (not `startsWith`) and guarded by origin. Pad URL reads the old forms.
 */
export function classifyInternalDocumentLink(
  href: string,
  currentPathname: string
): InternalDocumentLink | null {
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined
  const base = origin ?? 'http://localhost'
  const pad = padUrlCore.parse(href, base)
  if (!pad || (origin && !pad.sameOrigin)) return null

  const currentDocSlug = padUrlCore.parse(currentPathname, base)?.slug
  if (!currentDocSlug || pad.slug !== currentDocSlug) return null

  return classifyPadFacets(pad, href)
}

/** The address of a same-origin pad, or `null`. A path with a file extension is a public file. */
const anotherPad = (href: string): PadFacets | null => {
  const pad = padUrlCore.parse(href, window.location.origin)
  if (!pad?.sameOrigin || !pad.slug || isReservedSlug(pad.slug)) return null
  return /\.[a-z0-9]+$/i.test(new URL(href, window.location.origin).pathname) ? null : pad
}

/** The one order of the link rules. This pad comes first, because `anotherPad` accepts it too. */
export const linkDestination = (
  href: string,
  pathname = window.location.pathname
): LinkDestination => {
  const link = classifyInternalDocumentLink(href, pathname)
  if (link) return { kind: 'here', link }
  const pad = anotherPad(href)
  if (pad) return { kind: 'pad', pad }
  return isWebHref(href) ? { kind: 'web' } : { kind: 'other' }
}

/** Resolve a heading/channel `toc-id` to its heading text. */
const resolveHeadingTitle = (editor: Editor | null, tocId: string): string | undefined =>
  editor ? headingAncestry(editor, tocId).at(-1)?.text || undefined : undefined

const HERE = 'In this document'
const quoted = (title: string): string => `\u201C${title}\u201D`

/** Human label, icon and spoken name for an in-document destination. Resolves heading/channel titles from the pad editor. */
export function describeInternalDocumentLink(
  link: InternalDocumentLink,
  editor: Editor | null
): InternalLinkDescriptor {
  switch (link.kind) {
    case 'document':
      return {
        label: 'This document',
        sublabel: 'Go to top',
        icon: INTERNAL_KIND_ICON.document,
        accessibleName: 'Go to top of this document.'
      }
    case 'heading': {
      const title = resolveHeadingTitle(editor, link.headingId)
      return {
        label: title ? quoted(title) : 'Heading',
        sublabel: `${HERE} \u00B7 Heading`,
        icon: INTERNAL_KIND_ICON.heading,
        accessibleName: title ? `Go to heading: ${title}.` : 'Go to heading.'
      }
    }
    case 'chat': {
      const title = resolveHeadingTitle(editor, link.linkId)
      const noun = link.messageId ? 'Message' : 'Chat'
      return {
        label: title ? quoted(title) : 'Chat',
        sublabel: title ? `${HERE} \u00B7 ${noun}` : HERE,
        icon: INTERNAL_KIND_ICON.chat,
        accessibleName: `Go to ${noun.toLowerCase()}${title ? `: ${title}` : ''}.`
      }
    }
    case 'filter': {
      const modeLabel = link.mode === 'and' ? 'Match all' : 'Match any'
      return {
        label: INTERNAL_KIND_NAME.filter,
        sublabel: HERE,
        icon: INTERNAL_KIND_ICON.filter,
        accessibleName: `Go to filtered view: ${link.terms.join(', ')}. ${modeLabel}.`,
        modeLabel
      }
    }
    case 'history':
      return {
        label: link.version == null ? 'History' : `Version ${link.version}`,
        sublabel: `${HERE} \u00B7 History`,
        icon: INTERNAL_KIND_ICON.history,
        accessibleName:
          link.version == null ? 'Go to version history.' : `Go to version ${link.version}.`
      }
    default: {
      const exhaustive: never = link
      return exhaustive
    }
  }
}
