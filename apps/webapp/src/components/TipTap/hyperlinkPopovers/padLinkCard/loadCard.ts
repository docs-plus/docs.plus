import { padUrl } from '@services/padUrl'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import { supabaseClient } from '@utils/supabase'
import { plainTitle } from '@utils/titleWrite'

import { classifyPadFacets } from '../internalDocumentLink'
import type { PadLink } from '../types'
import { editorCardReply } from './editorCard'
import {
  cardQuery,
  type CardReply,
  type CardView,
  fetchCardReply,
  hovercardUrl,
  toCardView
} from './model'

const REQUEST_TIMEOUT_MS = 8_000

// One request per reader and link at a time. Nothing is kept after it settles:
// the answer depends on who reads it, so it never enters the URL-keyed metadata cache.
const inFlight = new Map<string, Promise<CardReply | null>>()

const requestReply = async (slug: string, query: URLSearchParams): Promise<CardReply | null> => {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession()
  const key = `${session?.user.id ?? ''} ${hovercardUrl(slug, query)}`
  const running = inFlight.get(key)
  if (running) return running

  const headers: Record<string, string> = {}
  if (session?.access_token) headers.token = session.access_token
  const request = fetchCardReply(slug, query, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
    .catch(() => null)
    .finally(() => inFlight.delete(key))
  inFlight.set(key, request)
  return request
}

/** The Pad title as the server picks it: a title still equal to the slug gives way to the Title. */
const openPadTitle = (editor: Editor, slug: string): string => {
  const title = plainTitle(useStore.getState().settings.metadata.title ?? '').trim()
  if (title && title !== slug) return title
  return editor.state.doc.firstChild?.textContent.trim() || title
}

/**
 * The card for a docs.plus link. A heading or filter in this pad reads the open editor and
 * makes no request. Every other kind, and every other pad, asks the route. `null` is no reply.
 */
export const loadCardView = async (
  destination: PadLink,
  editor: Editor
): Promise<CardView | null> => {
  // A `here` link names the open pad, so its slug is the open address's.
  const slug = destination.kind === 'pad' ? destination.pad.slug : padUrl.read()?.slug
  if (!slug) return null
  const link = destination.kind === 'here' ? destination.link : classifyPadFacets(destination.pad)
  if (destination.kind === 'here' && (link.kind === 'heading' || link.kind === 'filter')) {
    const local = editorCardReply(editor, link, openPadTitle(editor, slug))
    return local && toCardView(local)
  }
  const reply = await requestReply(slug, cardQuery(link))
  return reply ? toCardView(reply) : null
}
