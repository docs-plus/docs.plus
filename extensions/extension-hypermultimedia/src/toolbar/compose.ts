import type {
  MediaAction,
  MediaActionList,
  MediaActionPlacement,
  MediaActionsResolver
} from './types'

/** Where a brick snaps relative to another by id; omit both to append to the end. */
export interface MediaActionAnchor {
  before?: string
  after?: string
}

/** Immutable lego-style editor for the resolved action list — every method returns a new builder. */
export interface MediaActionsBuilder {
  /** Insert (or move, if the id already exists) a brick at the anchor. */
  add(action: MediaAction, at?: MediaActionAnchor): MediaActionsBuilder
  remove(...ids: string[]): MediaActionsBuilder
  /** Reposition an existing brick; no-op if the id is absent. */
  move(id: string, at: MediaActionAnchor): MediaActionsBuilder
  /** Swap a brick's definition in place; no-op if the id is absent. */
  replace(id: string, action: MediaAction): MediaActionsBuilder
  setPlacement(id: string, placement: MediaActionPlacement): MediaActionsBuilder
  toInline(id: string): MediaActionsBuilder
  toOverflow(id: string): MediaActionsBuilder
  /** Order listed ids first (in the given sequence); unlisted bricks keep their relative order after. */
  order(ids: string[]): MediaActionsBuilder
  has(id: string): boolean
  result(): MediaActionList
}

const withoutId = (list: MediaActionList, id: string): MediaActionList =>
  list.filter((action) => action.id !== id)

function anchorIndex(list: MediaActionList, at?: MediaActionAnchor): number {
  if (at?.before) {
    const i = list.findIndex((action) => action.id === at.before)
    if (i !== -1) return i
  }
  if (at?.after) {
    const i = list.findIndex((action) => action.id === at.after)
    if (i !== -1) return i + 1
  }
  return list.length
}

function spliced(
  list: MediaActionList,
  action: MediaAction,
  at?: MediaActionAnchor
): MediaActionList {
  const base = withoutId(list, action.id)
  const i = anchorIndex(base, at)
  return [...base.slice(0, i), action, ...base.slice(i)]
}

function mapById(
  list: MediaActionList,
  id: string,
  fn: (action: MediaAction) => MediaAction
): MediaActionList {
  const i = list.findIndex((action) => action.id === id)
  if (i === -1) return list
  const next = list.slice()
  next[i] = fn(next[i])
  return next
}

function make(list: MediaActionList): MediaActionsBuilder {
  const setPlacement = (id: string, placement: MediaAction['placement']): MediaActionsBuilder =>
    make(mapById(list, id, (action) => ({ ...action, placement })))

  return {
    add: (action, at) => make(spliced(list, action, at)),
    remove: (...ids) => {
      const drop = new Set(ids)
      return make(list.filter((action) => !drop.has(action.id)))
    },
    move: (id, at) => {
      const found = list.find((action) => action.id === id)
      return found ? make(spliced(list, found, at)) : make(list)
    },
    replace: (id, action) => make(mapById(list, id, () => action)),
    setPlacement,
    toInline: (id) => setPlacement(id, 'inline'),
    toOverflow: (id) => setPlacement(id, 'overflow'),
    order: (ids) => {
      const rank = new Map(ids.map((id, i) => [id, i]))
      const last = Number.MAX_SAFE_INTEGER
      const next = list
        .map((action, i) => ({ action, i }))
        .sort((a, b) => {
          const ra = rank.get(a.action.id) ?? last
          const rb = rank.get(b.action.id) ?? last
          return ra === rb ? a.i - b.i : ra - rb
        })
        .map((entry) => entry.action)
      return make(next)
    },
    has: (id) => list.some((action) => action.id === id),
    result: () => list
  }
}

/** Start a lego-style edit over a resolved action list (typically the `mediaActions` `defaults`). */
export function composeMediaActions(actions: MediaActionList): MediaActionsBuilder {
  return make(actions.slice())
}

/** Declarative row layout by id; unlisted known actions keep their placement and append after. */
export interface MediaToolbarLayout {
  inline?: string[]
  overflow?: string[]
}

/** Sugar: a `mediaActions` resolver that arranges the inline and overflow rows by id. */
export function layoutMediaActions(
  layout: MediaToolbarLayout | ((ctx: { nodeType: string }) => MediaToolbarLayout)
): MediaActionsResolver {
  return (defaults, ctx) => {
    const { inline = [], overflow = [] } = typeof layout === 'function' ? layout(ctx) : layout
    let builder = composeMediaActions(defaults)
    for (const id of inline) builder = builder.toInline(id)
    for (const id of overflow) builder = builder.toOverflow(id)
    return builder.order([...inline, ...overflow]).result()
  }
}
