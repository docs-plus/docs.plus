import type { TiptapDocJson } from '../../document-content/types'
import type { Section, SectionChange, SectionChangeCounts } from '../types'
import { diffSections } from './diffSections'
import { movedTocIds, pairSections } from './pairSections'
import { segmentSections } from './segmentSections'

/** A factory, so no caller can mutate a shared zero. */
export const noSectionChanges = (): SectionChangeCounts => ({
  sectionsAdded: 0,
  sectionsRemoved: 0,
  sectionsModified: 0,
  sectionsMoved: 0,
  wordsAdded: 0,
  wordsRemoved: 0
})

/**
 * Segment, pair, diff and tally two decoded docs. The change digest and the Version card
 * both call it, so their counts cannot drift. Decode and the byte-equal shortcut stay with
 * each caller: each has its own error policy, and the Version card decodes the head first.
 */
export const compareDocs = (
  baseline: TiptapDocJson | null,
  head: TiptapDocJson,
  onSectionError: (error: unknown, tocId: string | null) => void
): { sections: SectionChange[]; counts: SectionChangeCounts } => {
  const baselineSections: Section[] = baseline ? segmentSections(baseline) : []
  const pairs = pairSections(baselineSections, segmentSections(head))
  const sections = diffSections(pairs, onSectionError, movedTocIds(baselineSections, pairs))
  const counts = noSectionChanges()
  for (const section of sections) {
    if (section.status === 'added') counts.sectionsAdded += 1
    else if (section.status === 'removed') counts.sectionsRemoved += 1
    else if (section.status === 'modified') counts.sectionsModified += 1
    else if (section.status === 'moved') counts.sectionsMoved += 1
    counts.wordsAdded += section.magnitude?.wordsAdded ?? 0
    counts.wordsRemoved += section.magnitude?.wordsRemoved ?? 0
  }
  return { sections, counts }
}
