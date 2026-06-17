import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import {
  canMapDecorations,
  computeSection,
  filterSections,
  findAllSections,
  matchSections,
  transactionAffectsNodeType
} from '../shared'
import type { SectionMatch } from '../shared/match-section'
import type { HeadingFilterFoldAdapter } from './heading-filter'

export type HeadingFilterMeta =
  | { type: 'clear' }
  | { type: 'apply'; slugs: string[]; mode: 'or' | 'and' }

export interface HeadingFilterState {
  slugs: string[]
  mode: 'or' | 'and'
  matchedSectionIds: Set<string>
  totalSections: number
  decos: DecorationSet
}

export interface HeadingFilterPluginOptions {
  foldAdapter?: HeadingFilterFoldAdapter
}

export const headingFilterPluginKey = new PluginKey<HeadingFilterState>('headingFilter')

function buildFilterDecorations(
  doc: PMNode,
  slugs: string[],
  perQueryMatches?: Map<string, SectionMatch[]>
): DecorationSet {
  if (slugs.length === 0) return DecorationSet.empty

  const decorations: Decoration[] = []
  const seenRanges = new Set<string>()

  for (const query of slugs) {
    const sectionMatches = perQueryMatches?.get(query) ?? matchSections(doc, query)
    for (const sm of sectionMatches) {
      for (const m of sm.matches) {
        const key = `${m.from}:${m.to}`
        if (seenRanges.has(key)) continue
        seenRanges.add(key)

        decorations.push(Decoration.inline(m.from, m.to, { class: 'heading-filter-highlight' }))
      }
    }
  }

  return decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty
}

function computeNewState(
  base: { slugs: string[]; mode: 'or' | 'and' },
  doc: PMNode
): HeadingFilterState {
  const sections = findAllSections(doc)
  const totalSections = sections.length

  // One matchSections pass per slug, reused for the matched-id set + highlights.
  const perQueryMatches = new Map<string, SectionMatch[]>()
  for (const q of new Set(base.slugs)) perQueryMatches.set(q, matchSections(doc, q, sections))

  let matchedSectionIds: Set<string>
  if (base.slugs.length > 0) {
    const { matchedIds } = filterSections(doc, base.slugs, base.mode, { sections, perQueryMatches })
    matchedSectionIds = matchedIds
  } else {
    matchedSectionIds = new Set(sections.map((s) => s.id))
  }

  return {
    ...base,
    matchedSectionIds,
    totalSections,
    decos: buildFilterDecorations(doc, base.slugs, perQueryMatches)
  }
}

function applyMeta(
  meta: HeadingFilterMeta,
  prev: HeadingFilterState,
  doc: PMNode
): HeadingFilterState {
  switch (meta.type) {
    case 'clear':
      return computeNewState({ slugs: [], mode: 'or' }, doc)

    case 'apply':
      return computeNewState({ slugs: meta.slugs, mode: meta.mode }, doc)
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

        const isActive = prev.slugs.length > 0

        // Force full rebuild on Yjs remote transactions
        if (tr.getMeta('y-sync$')) {
          if (!isActive) {
            const sections = findAllSections(tr.doc)
            return {
              ...prev,
              matchedSectionIds: new Set(sections.map((s) => s.id)),
              totalSections: sections.length
            }
          }
          return computeNewState({ slugs: prev.slugs, mode: prev.mode }, tr.doc)
        }

        // Mappable steps and non-heading edits never change section membership;
        // either keep prev or just remap the highlight decorations.
        if (canMapDecorations(tr, tr.before) || !transactionAffectsNodeType(tr, 'heading')) {
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

        return computeNewState({ slugs: prev.slugs, mode: prev.mode }, tr.doc)
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

          if (current.slugs.length === 0 && prevSlugs.length === 0) {
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

          const hadFilters = prevSlugs.length > 0
          const hasFilters = current.slugs.length > 0

          if (slugsChanged) prevSlugs = [...current.slugs]
          if (modeChanged) prevMode = current.mode
          if (matchedIdsChanged) prevMatchedIds = current.matchedSectionIds

          const foldNeedsSync = slugsChanged || modeChanged || (matchedIdsChanged && hasFilters)
          if (options.foldAdapter && foldNeedsSync) {
            try {
              if (!hadFilters && hasFilters) {
                savedFoldIds = new Set(options.foldAdapter.getFoldedIds(view.state))
              }

              const allSections = findAllSections(view.state.doc)
              let tr: Transaction | null = null

              if (hasFilters) {
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

              // If the caret sits in the BODY of a now-folded section, lift it to
              // that section's (still-visible) heading line — same tr, single dispatch.
              if (
                tr &&
                (slugsChanged || matchedIdsChanged) &&
                hasFilters &&
                current.matchedSectionIds.size > 0
              ) {
                const { doc } = view.state
                const cursorPos = view.state.selection.$head.pos
                let restorePos: number | null = null

                for (const s of allSections) {
                  if (current.matchedSectionIds.has(s.id)) continue
                  const heading = doc.content.child(s.childIndex)
                  const bodyFrom = s.pos + heading.nodeSize
                  const { to: sectionTo } = computeSection(doc, s.pos, s.level, s.childIndex)
                  if (cursorPos >= bodyFrom && cursorPos < sectionTo) {
                    // end of the heading line stays visible while the body folds
                    restorePos = s.pos + heading.nodeSize - 1
                    break
                  }
                }

                if (restorePos !== null) {
                  const $pos = doc.resolve(restorePos)
                  tr.setSelection(TextSelection.near($pos, -1)).scrollIntoView()
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
