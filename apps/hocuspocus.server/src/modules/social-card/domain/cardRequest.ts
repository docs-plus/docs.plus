export const CARD_KINDS = ['document', 'heading', 'chat', 'message', 'version', 'filter'] as const
export type CardKind = (typeof CARD_KINDS)[number]

/**
 * The sub-ids a pad link carries, after the shape checks. The field names are the query keys
 * of the slug read and of the card image URL; each comment names the pad link's own key.
 * `cardQueryOf` in `apps/webapp/src/utils/documentServerSideProps.ts` writes the slug-read keys.
 */
export interface CardQuery {
  /** Heading `toc-id`; `id=` in the pad link. */
  id?: string
  /** Chat room link id, a channel id or a heading id; `chatroom=` in the pad link. */
  c?: string
  /** Message id, read only with `c`; `msg_id=` in the pad link. */
  m?: string
  /** Filter terms; path segments in the pad link. */
  t?: string[]
  /** Only `and` is carried; `or` is the default. */
  mode?: 'and'
  /** History version number; `?version=` in the pad link. */
  version?: number
}

// A toc-id, a channel id or a message uuid: all fit 36 characters.
export const SUB_ID = /^[A-Za-z0-9_-]{1,36}$/
export const MESSAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const VERSION = /^[1-9]\d{0,8}$/
// The term cap: a filter link with more terms or longer terms gets the Document card.
export const MAX_TERMS = 4
export const MAX_TERM_CHARS = 60

/** The trimmed, non-empty terms, or null when none is left or one cap is passed. */
export const keptTerms = (raw: string[], max: number): string[] | null => {
  const terms = raw.map((term) => term.trim()).filter(Boolean)
  const usable =
    terms.length > 0 && terms.length <= max && terms.every((term) => term.length <= MAX_TERM_CHARS)
  return usable ? terms : null
}

/** The two query readers a request offers; Hono's `c.req` is one. */
export interface QuerySource {
  query: (key: string) => string | undefined
  queries: (key: string) => string[] | undefined
}

/**
 * Reads the card sub-ids from a request. A value with a bad shape is dropped, never
 * passed on, so it costs no read and draws nothing.
 */
export const parseCardQuery = (req: QuerySource): CardQuery => {
  const query: CardQuery = {}
  const id = req.query('id')
  if (id && SUB_ID.test(id)) query.id = id
  const c = req.query('c')
  if (c && SUB_ID.test(c)) {
    query.c = c
    const m = req.query('m')
    if (m && MESSAGE_ID.test(m)) query.m = m
  }
  const terms = keptTerms(req.queries('t') ?? [], MAX_TERMS)
  if (terms) {
    query.t = terms
    if (req.query('mode') === 'and') query.mode = 'and'
  }
  const version = req.query('version')
  if (version && VERSION.test(version)) query.version = Number(version)
  return query
}

/** The query string for the card image URL: the kept sub-ids, then `v`. */
export const cardImageQuery = (query: CardQuery, v: string): string => {
  const params = new URLSearchParams()
  if (query.id) params.set('id', query.id)
  if (query.c) params.set('c', query.c)
  if (query.m) params.set('m', query.m)
  for (const term of query.t ?? []) params.append('t', term)
  if (query.mode) params.set('mode', query.mode)
  if (query.version) params.set('version', String(query.version))
  params.set('v', v)
  return params.toString()
}
