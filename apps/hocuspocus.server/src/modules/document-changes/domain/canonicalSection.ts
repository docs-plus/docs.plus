import { canonicalizeBlock } from '../../document-versions/domain/canonicalizeBlock'
import type { Section } from '../types'

/** Heading first, then the body. One list is what both the hash and the changeset read. */
export const sectionNodes = (section: Section): Record<string, unknown>[] =>
  section.heading === null ? section.nodes : [section.heading, ...section.nodes]

/**
 * Equality key for one section. The heading rides along, so level, text and
 * heading marks are all covered; a heading level 2 to 3 change leaves both node
 * lists identical and would otherwise be invisible. `canonicalizeBlock` drops
 * `toc-id`, which the webapp stamps on first open and is churn, not an edit.
 */
export const canonicalSection = (section: Section): string =>
  JSON.stringify(canonicalizeBlock(sectionNodes(section)))
