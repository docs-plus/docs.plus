import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import {
  canMapDecorations,
  filterSections,
  findAllSections,
  matchSections,
  transactionAffectsNodeType
} from '../shared'
import type { HeadingFilterFoldAdapter } from './heading-filter'

export type HeadingFilterMeta =
  | { type: 'preview'; query: string }
  | { type: 'commit'; slug: string }
  | { type: 'remove'; slug: string }
  | { type: 'clear' }
  | { type: 'setMode'; mode: 'or' | 'and' }
  | { type: 'apply'; slugs: string[]; mode: 'or' | 'and' }

export interface HeadingFilterState {
  slugs: string[]
  mode: 'or' | 'and'
  previewQuery: string
  matchedSectionIds: Set<string>
  totalSections: number
  decos: DecorationSet
}

export interface HeadingFilterCallbackState {
  matchedSectionIds: Set<string>
  totalSections: number
  slugs: string[]
  mode: 'or' | 'and'
}

export interface HeadingFilterPluginOptions {
  onFilterChange?: (state: HeadingFilterCallbackState) => void
  foldAdapter?: HeadingFilterFoldAdapter
}

export const headingFilterPluginKey = new PluginKey<HeadingFilterState>('headingFilter')

function buildFilterDecorations(
  doc: PMNode,
  state: Omit<HeadingFilterState, 'decos'>
): DecorationSet {
  const { slugs, previewQuery } = state

  if (slugs.length === 0 && previewQuery.length === 0) return DecorationSet.empty

  const decorations: Decoration[] = []

  const allQueries = [...slugs]
  if (previewQuery.length > 0) allQueries.push(previewQuery)

  const seenRanges = new Set<string>()

  for (const query of allQueries) {
    const sectionMatches = matchSections(doc, query)
    for (const sm of sectionMatches) {
      for (const m of sm.matches) {
        const key = `${m.from}:${m.to}`
        if (seenRanges.has(key)) continue
        seenRanges.add(key)

        decorations.push(
          Decoration.inline(m.from, m.to, {
            class: 'heading-filter-highlight'
          })
        )
      }
    }
  }

  return decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty
}

function computeNewState(
  base: Omit<HeadingFilterState, 'decos' | 'matchedSectionIds' | 'totalSections'>,
  doc: PMNode
): HeadingFilterState {
  const sections = findAllSections(doc)
  const totalSections = sections.length

  let matchedSectionIds: Set<string>
  if (base.previewQuery.length > 0) {
    const previewMatches = matchSections(doc, base.previewQuery)
    matchedSectionIds = new Set(previewMatches.map((sm) => sm.section.id))
  } else if (base.slugs.length > 0) {
    const { matchedIds } = filterSections(doc, base.slugs, base.mode)
    matchedSectionIds = matchedIds
  } else {
    matchedSectionIds = new Set(sections.map((s) => s.id))
  }

  const full = { ...base, matchedSectionIds, totalSections }
  return { ...full, decos: buildFilterDecorations(doc, full) }
}

function applyMeta(
  meta: HeadingFilterMeta,
  prev: HeadingFilterState,
  doc: PMNode
): HeadingFilterState {
  switch (meta.type) {
    case 'preview':
      return computeNewState({ slugs: prev.slugs, mode: prev.mode, previewQuery: meta.query }, doc)

    case 'commit': {
      const slug = meta.slug.trim().toLowerCase()
      if (!slug || prev.slugs.includes(slug)) return prev
      return computeNewState(
        {
          slugs: [...prev.slugs, slug],
          mode: prev.mode,
          previewQuery: ''
        },
        doc
      )
    }

    case 'remove': {
      const filtered = prev.slugs.filter((s) => s !== meta.slug)
      if (filtered.length === prev.slugs.length) return prev
      return computeNewState(
        { slugs: filtered, mode: prev.mode, previewQuery: prev.previewQuery },
        doc
      )
    }

    case 'clear':
      return computeNewState({ slugs: [], mode: 'or', previewQuery: '' }, doc)

    case 'setMode':
      if (meta.mode === prev.mode) return prev
      return computeNewState(
        { slugs: prev.slugs, mode: meta.mode, previewQuery: prev.previewQuery },
        doc
      )

    case 'apply':
      return computeNewState({ slugs: meta.slugs, mode: meta.mode, previewQuery: '' }, doc)
  }
}

export function createHeadingFilterPlugin(
  options: HeadingFilterPluginOptions
): Plugin<HeadingFilterState> {
  let prevSlugs: string[] = []
  let prevMode: 'or' | 'and' = 'or'
  let prevMatchedIds: Set<string> = new Set()
  let savedFoldIds: Set<string> | null = null

  return new Plugin<HeadingFilterState>({
    key: headingFilterPluginKey,

    state: {
      init(_, { doc }): HeadingFilterState {
        const sections = findAllSections(doc)
        return {
          slugs: [],
          mode: 'or',
          previewQuery: '',
          matchedSectionIds: new Set(sections.map((s) => s.id)),
          totalSections: sections.length,
          decos: DecorationSet.empty
        }
      },

      apply(tr, prev): HeadingFilterState {
        const meta = tr.getMeta(headingFilterPluginKey) as HeadingFilterMeta | undefined

        if (meta) {
          return applyMeta(meta, prev, tr.doc)
        }

        if (!tr.docChanged) return prev

        // Force full rebuild on Yjs remote transactions
        if (tr.getMeta('y-sync$')) {
          const isActive = prev.slugs.length > 0 || prev.previewQuery.length > 0
          if (!isActive) {
            const sections = findAllSections(tr.doc)
            return {
              ...prev,
              matchedSectionIds: new Set(sections.map((s) => s.id)),
              totalSections: sections.length
            }
          }
          return computeNewState(
            { slugs: prev.slugs, mode: prev.mode, previewQuery: prev.previewQuery },
            tr.doc
          )
        }

        const isActive = prev.slugs.length > 0 || prev.previewQuery.length > 0

        if (canMapDecorations(tr, tr.before)) {
          if (!isActive) return prev
          return { ...prev, decos: prev.decos.map(tr.mapping, tr.doc) }
        }

        if (!transactionAffectsNodeType(tr, 'heading')) {
          if (!isActive) return prev
          return { ...prev, decos: prev.decos.map(tr.mapping, tr.doc) }
        }

        if (!isActive) {
          const sections = findAllSections(tr.doc)
          return {
            ...prev,
            matchedSectionIds: new Set(sections.map((s) => s.id)),
            totalSections: sections.length
          }
        }

        return computeNewState(
          {
            slugs: prev.slugs,
            mode: prev.mode,
            previewQuery: prev.previewQuery
          },
          tr.doc
        )
      }
    },

    props: {
      decorations(state) {
        return headingFilterPluginKey.getState(state)?.decos ?? DecorationSet.empty
      }
    },

    view() {
      return {
        update(view) {
          const current = headingFilterPluginKey.getState(view.state)
          if (!current) return

          if (current.slugs.length === 0 && prevSlugs.length === 0 && !current.previewQuery) {
            return
          }

          const slugsChanged =
            current.slugs.length !== prevSlugs.length ||
            current.slugs.some((s, i) => s !== prevSlugs[i])

          const modeChanged = current.mode !== prevMode

          let matchedIdsChanged = current.matchedSectionIds.size !== prevMatchedIds.size
          if (!matchedIdsChanged) {
            for (const id of current.matchedSectionIds) {
              if (!prevMatchedIds.has(id)) {
                matchedIdsChanged = true
                break
              }
            }
          }

          if (slugsChanged || modeChanged || matchedIdsChanged) {
            options.onFilterChange?.({
              matchedSectionIds: current.matchedSectionIds,
              totalSections: current.totalSections,
              slugs: current.slugs,
              mode: current.mode
            })
          }

          const hadFilters = prevSlugs.length > 0
          const hasFilters = current.slugs.length > 0

          if (slugsChanged) prevSlugs = [...current.slugs]
          if (modeChanged) prevMode = current.mode
          if (matchedIdsChanged) prevMatchedIds = current.matchedSectionIds

          if (options.foldAdapter && (slugsChanged || modeChanged)) {
            try {
              if (!hadFilters && hasFilters) {
                savedFoldIds = new Set(options.foldAdapter.getFoldedIds(view.state))
              }

              let tr: Transaction | null = null

              if (hasFilters) {
                const allSections = findAllSections(view.state.doc)
                const sectionsToFold = new Set<string>()
                for (const s of allSections) {
                  if (!current.matchedSectionIds.has(s.id)) {
                    sectionsToFold.add(s.id)
                  }
                }

                tr = options.foldAdapter.setTemporaryFolds(view.state.tr, sectionsToFold)
              } else if (hadFilters && !hasFilters) {
                tr = options.foldAdapter.restoreFolds(
                  view.state.tr,
                  savedFoldIds ?? new Set<string>()
                )
                savedFoldIds = null
              }

              // Check if cursor is in a folded section and fix in the same transaction
              if (tr && slugsChanged && hasFilters && current.matchedSectionIds.size > 0) {
                const { doc } = view.state
                const cursorPos = view.state.selection.$head.pos
                let cursorInFolded = false
                let offset = 0

                for (let i = 0; i < doc.content.childCount; i++) {
                  const child = doc.content.child(i)
                  offset += child.nodeSize

                  if (i === 0) continue
                  if (child.type.name !== 'heading') continue

                  const tocId = child.attrs['toc-id'] as string
                  if (!tocId || current.matchedSectionIds.has(tocId)) continue

                  if (cursorPos >= offset - child.nodeSize && cursorPos < offset) {
                    cursorInFolded = true
                    break
                  }
                }

                if (cursorInFolded) {
                  const $pos = doc.resolve(1)
                  tr.setSelection(TextSelection.near($pos)).scrollIntoView()
                }
              }

              if (tr) view.dispatch(tr)
            } catch {
              /* adapter error — degrade gracefully */
            }
          }
        },

        destroy() {
          prevSlugs = []
          prevMode = 'or'
          prevMatchedIds = new Set()
          savedFoldIds = null
        }
      }
    }
  })
}
