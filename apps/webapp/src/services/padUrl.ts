import {
  type PadChange,
  type PadFacets,
  type PadTarget,
  type PadUrlContext,
  padUrlCore,
  type PadWrite
} from '@docs.plus/pad-url'
import { useStore } from '@stores'
import { headingSlug, headingSlugTrail } from '@utils/headingSlugTrail'
import Router from 'next/router'

import { whenHistoryDismissSettles } from './historyDismiss'

/** The workspace chat id stands for the whole document, so its trail is the Pad title. */
function trailOf(headingId: string): string | null {
  const { editor, metadata } = useStore.getState().settings
  if (headingId === metadata?.documentId) return headingSlug(metadata.title ?? '')
  if (!editor.instance || editor.instance.isDestroyed) return null
  return headingSlugTrail(editor.instance, headingId)
}

/** The first path segment, read as `parse` reads it, without a full parse per link. */
const padSlug = (): string => window.location.pathname.split('/').filter(Boolean)[0] ?? ''

function context(): PadUrlContext {
  return { origin: window.location.origin, live: window.location.href, trailOf }
}

/** Raw writes touch only `h` and `id`; the path and `mode` go through the Router. */
function write(planned: PadWrite | null): Promise<unknown> {
  if (!planned) return Promise.resolve()
  const { to, writer } = planned
  switch (writer) {
    case 'keepState':
      // Open overlays park their dismiss marker on this entry's state.
      window.history.replaceState(window.history.state, '', to)
      return Promise.resolve()
    case 'pushBlank':
      window.history.pushState({}, '', to)
      return Promise.resolve()
    case 'routerPush':
      return Router.push(to, undefined, { shallow: true })
    case 'routerReplace':
      return Router.replace(to, undefined, { shallow: true })
  }
}

let tail: Promise<void> | null = null

function go(change: PadChange): Promise<void> {
  // A closing drawer or sheet pops its history entry after the tap; a write before that
  // lands is lost to it. Chat close skips the wait, so it writes at once when nothing is queued.
  const step = async () => {
    if (change.kind !== 'chatClosed') {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await whenHistoryDismissSettles()
    }
    await write(padUrlCore.plan(change, context()))
  }
  const done = (tail ? tail.then(step) : step()).catch((error: unknown) => {
    console.error('[padUrl] write failed', error)
  })
  tail = done
  void done.then(() => {
    if (tail === done) tail = null
  })
  return done
}

function read(href?: string): PadFacets | null {
  if (typeof window === 'undefined') return null
  return padUrlCore.parse(href ?? window.location.href, window.location.origin)
}

/** The address's message id, but only when its chat names this room. */
function messageFor(room: {
  headingId?: string | null
  channelId?: string | null
}): string | undefined {
  const chat = read()?.chat
  if (!chat?.messageId) return undefined
  return chat.linkId === room.headingId || chat.linkId === room.channelId
    ? chat.messageId
    : undefined
}

/**
 * Pad URL: the one module that builds, writes and reads pad addresses.
 * `link` starts from the pad base, so no live filter, chat or heading state leaks in.
 * `go` starts from the live address and picks the history writer for the change.
 */
export const padUrl = {
  link: (target: PadTarget, form?: 'absolute' | 'path'): string =>
    padUrlCore.format(target, { origin: window.location.origin, slug: padSlug(), trailOf }, form),
  go,
  read,
  messageFor
}
