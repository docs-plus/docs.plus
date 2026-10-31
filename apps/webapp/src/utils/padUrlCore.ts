import type {
  FilterMode,
  PadChange,
  PadFacets,
  PadTarget,
  PadUrlContext,
  PadWrite
} from '../types/padUrl'

const slugOf = (pathname: string): string => pathname.split('/').filter(Boolean)[0] ?? ''

/** A space is written `-`, so any run of whitespace or hyphens is one gap to the filter. */
const foldTerm = (term: string): string =>
  term
    .toLowerCase()
    .replace(/[\s-]+/g, ' ')
    .trim()

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The filter's search for one term, under the same gap rule as `foldTerm`. A pattern, not a
 * folded string, because a gap of any width must still match: a heading may hold a
 * non-breaking space, a tab or two spaces. `null` for a blank term.
 */
const termPattern = (term: string): RegExp | null => {
  const words = term.split(/[\s-]+/).filter(Boolean)
  return words.length ? new RegExp(words.map(escapeRegExp).join('[\\s-]+'), 'giu') : null
}

const encodeTerm = (term: string): string =>
  encodeURIComponent(term.trim().toLowerCase().replace(/\s+/g, '-'))

/** Old links carry `%20`. A malformed escape such as `%E0` throws, so it stays raw. */
const decodeTerm = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

const termsOf = (url: URL): string[] =>
  url.pathname.split('/').filter(Boolean).slice(1).map(decodeTerm)

/** Every write re-encodes every term, so an old `%20` path comes out clean. */
const setTerms = (url: URL, terms: string[]): void => {
  const segments = [slugOf(url.pathname), ...terms.map(encodeTerm)]
  url.pathname = `/${segments.filter(Boolean).join('/')}`
}

const pathOf = (url: URL): string => `${url.pathname}${url.search}${url.hash}`

const modeOf = (url: URL): FilterMode | null => {
  const mode = url.searchParams.get('mode')
  return mode === 'and' || mode === 'or' ? mode : null
}

/** Deletes first, so the given keys land last, in the order given. */
const setParams = (url: URL, params: Record<string, string | null | undefined>): void => {
  for (const key of Object.keys(params)) url.searchParams.delete(key)
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, value)
  }
}

const setHeading = (url: URL, headingId: string, ctx: PadUrlContext): void =>
  setParams(url, { h: ctx.trailOf(headingId), id: headingId })

/** Drops `h` and `id` only when `id` names the closed room, so a plain heading link survives. */
const stripChat = (url: URL, closedHeadingId: string | null): void => {
  for (const key of ['msg_id', 'chatroom', 'open_heading_chat']) url.searchParams.delete(key)
  if (url.searchParams.get('act') === 'ch') {
    for (const key of ['act', 'c_id', 'm_id']) url.searchParams.delete(key)
  }
  if (closedHeadingId && url.searchParams.get('id') === closedHeadingId) {
    setParams(url, { h: null, id: null })
  }
}

function format(target: PadTarget, ctx: PadUrlContext, form: 'absolute' | 'path' = 'absolute') {
  const slug =
    (target.kind === 'document' ? target.slug : undefined) ??
    slugOf(new URL(ctx.live, ctx.origin).pathname)
  const url = new URL(slug ? `/${slug}` : '/', ctx.origin)
  if (slug && target.kind === 'heading') setHeading(url, target.headingId, ctx)
  if (slug && target.kind === 'chat') {
    setParams(url, { chatroom: target.linkId, msg_id: target.messageId })
  }
  return form === 'path' ? pathOf(url) : url.href
}

function plan(change: PadChange, ctx: PadUrlContext): PadWrite | null {
  const url = new URL(ctx.live, ctx.origin)
  const slug = slugOf(url.pathname)
  if (!slug) return null
  const before = pathOf(url)
  let writer: PadWrite['writer'] = 'routerPush'

  switch (change.kind) {
    case 'heading':
      setHeading(url, change.headingId, ctx)
      writer = change.entry === 'push' ? 'pushBlank' : 'keepState'
      break
    case 'focus': {
      if (!change.term.trim()) return null
      const to = new URL(`/${slug}`, ctx.origin)
      setTerms(to, [change.term])
      setParams(to, { id: change.headingId })
      return { to: pathOf(to), writer }
    }
    case 'filterAdd': {
      if (!change.term.trim()) return null
      const terms = termsOf(url)
      const folded = foldTerm(change.term)
      if (!terms.some((term) => foldTerm(term) === folded)) terms.push(change.term)
      setTerms(url, terms)
      break
    }
    case 'filterRemove': {
      const folded = foldTerm(change.term)
      const terms = termsOf(url).filter((term) => foldTerm(term) !== folded)
      setTerms(url, terms)
      // Mode only applies with two or more terms, so it goes with the last one.
      if (terms.length === 0) url.searchParams.delete('mode')
      break
    }
    case 'filterMode':
      setParams(url, { mode: change.mode === 'and' ? 'and' : null })
      break
    case 'filterReset':
      setTerms(url, [])
      url.searchParams.delete('mode')
      break
    case 'filterOpen': {
      // A stored filter link keeps the reader's mode when it names none.
      const to = new URL(change.href, ctx.origin)
      const liveMode = modeOf(url)
      if (liveMode && !to.searchParams.has('mode')) setParams(to, { mode: liveMode })
      setTerms(to, termsOf(to))
      return { to: pathOf(to), writer }
    }
    case 'chatClosed':
      stripChat(url, change.headingId)
      writer = 'routerReplace'
      break
  }

  const to = pathOf(url)
  return to === before ? null : { to, writer }
}

function parse(href: string, origin: string): PadFacets | null {
  let url: URL
  try {
    url = new URL(href, origin)
  } catch {
    return null
  }
  const params = url.searchParams
  const chatroom = params.get('chatroom')
  const legacyRoom = params.get('act') === 'ch' ? params.get('c_id') : null
  const chat = chatroom
    ? { linkId: chatroom, messageId: params.get('msg_id') || undefined }
    : legacyRoom
      ? { linkId: legacyRoom, messageId: params.get('m_id') || undefined }
      : null

  return {
    sameOrigin: url.origin === new URL(origin).origin,
    slug: slugOf(url.pathname),
    path: pathOf(url),
    terms: termsOf(url),
    mode: modeOf(url),
    headingId: params.get('id'),
    chat,
    signInChat: params.get('open_heading_chat'),
    hash: url.hash
  }
}

/**
 * The `?h=` trail as people read it. Only `%3E` is decoded: a `%20` or `%26` turned raw
 * would end or split the link in many paste targets. Display text only, never an href.
 */
const readable = (href: string): string => href.replace(/%3E/gi, '>')

/**
 * The pure core of Pad URL: every pad address is formatted, planned or parsed here.
 * Callers use `padUrl` (`@services/padUrl`). A module that must not load the store, or must
 * give the same answer on the server, uses this directly.
 */
export const padUrlCore = { format, plan, parse, termPattern, readable }
