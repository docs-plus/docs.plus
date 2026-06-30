import { Icons } from '@components/icons/registry'
import { parseHistoryHash } from '@components/pages/history/historyShareUrl'
import type { Editor } from '@tiptap/core'
import { TIPTAP_NODES } from '@types'

import type { InternalDocumentLink, InternalLinkDescriptor } from './types'

/**
 * `classify` is the single place that maps a raw href to an
 * `InternalDocumentLink`. Side-effectful execution lives in
 * `internalDocumentLinkActions.ts`; this module stays import-light so
 * `classify` is unit-testable without the app's store/Supabase graph.
 */

const internalDocSlug = (pathname: string): string | undefined =>
  pathname.split('/').filter(Boolean)[0]

/**
 * Pure: resolve a href to an in-document destination, or `null` for external.
 * Same dialect precedence as the legacy `navigateHref` ladder (history →
 * filter → chat → heading → legacy chat → bare document), with an exact
 * doc-slug match (not `startsWith`) and an origin guard.
 */
export function classifyInternalDocumentLink(
  href: string,
  currentPathname: string
): InternalDocumentLink | null {
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined
  let url: URL
  try {
    url = new URL(href, origin)
  } catch {
    return null
  }
  if (origin && url.origin !== origin) return null

  const currentDocSlug = internalDocSlug(currentPathname)
  const segments = url.pathname.split('/').filter(Boolean)
  if (!currentDocSlug || segments[0] !== currentDocSlug) return null

  const history = parseHistoryHash(url.hash)
  if (history.isHistory) return { kind: 'history', version: history.version }

  if (segments.length > 1) {
    return {
      kind: 'filter',
      terms: segments.slice(1).map(decodeURIComponent),
      mode: url.searchParams.get('mode') === 'and' ? 'and' : 'or',
      href
    }
  }

  const chatroom = url.searchParams.get('chatroom')
  if (chatroom) {
    return {
      kind: 'chat',
      channelId: chatroom,
      messageId: url.searchParams.get('msg_id') ?? undefined
    }
  }

  const headingId = url.searchParams.get('id')
  if (headingId) return { kind: 'heading', headingId }

  if (url.searchParams.get('act') === 'ch') {
    const channelId = url.searchParams.get('c_id')
    if (channelId) {
      return { kind: 'chat', channelId, messageId: url.searchParams.get('m_id') ?? undefined }
    }
  }

  return { kind: 'document' }
}

/** Resolve a heading/channel `toc-id` to its heading text, mirroring `buildHeadingHref`'s doc walk. */
const resolveHeadingTitle = (editor: Editor | null, tocId: string): string | undefined => {
  if (!editor) return undefined
  const { doc } = editor.state
  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    if (child.type.name !== TIPTAP_NODES.HEADING_TYPE) continue
    if ((child.attrs['toc-id'] as string) === tocId) {
      return child.textContent?.trim() || undefined
    }
  }
  return undefined
}

const HERE = 'In this document'
const quoted = (title: string): string => `\u201C${title}\u201D`

/** Human label + icon for an in-document destination. Resolves heading/channel titles from the pad editor. */
export function describeInternalDocumentLink(
  link: InternalDocumentLink,
  editor: Editor | null
): InternalLinkDescriptor {
  switch (link.kind) {
    case 'document':
      return { label: 'This document', sublabel: 'Go to top', icon: Icons.fileText }
    case 'heading': {
      const title = resolveHeadingTitle(editor, link.headingId)
      return {
        label: title ? quoted(title) : 'Heading',
        sublabel: `${HERE} \u00B7 Heading`,
        icon: Icons.heading
      }
    }
    case 'chat': {
      const title = resolveHeadingTitle(editor, link.channelId)
      const lead = link.messageId ? 'Message in chat' : 'Chat'
      return {
        label: title ? `${lead} \u00B7 ${quoted(title)}` : lead,
        sublabel: HERE,
        icon: Icons.chatroom
      }
    }
    case 'filter': {
      const n = link.terms.length
      return {
        label: `Filtered view \u00B7 ${n} term${n === 1 ? '' : 's'}`,
        sublabel: `${HERE} \u00B7 Match ${link.mode === 'and' ? 'all' : 'any'}`,
        icon: Icons.filter
      }
    }
    case 'history':
      return {
        label: link.version == null ? 'History' : `Version ${link.version}`,
        sublabel: `${HERE} \u00B7 History`,
        icon: Icons.history
      }
    default: {
      const exhaustive: never = link
      return exhaustive
    }
  }
}
