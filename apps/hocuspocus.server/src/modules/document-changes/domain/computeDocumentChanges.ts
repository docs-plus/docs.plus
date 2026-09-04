import { distinctUserIds } from '../../../lib/profiles'
import { readContent } from '../../document-content/domain/readContent'
import type { TiptapDocJson } from '../../document-content/types'
import { createChangesStore } from '../infra/changesStore'
import type {
  AnchorRef,
  ChangeSummary,
  ComputeDeps,
  ComputeDocumentChanges,
  ComputeOutcome,
  ComputeRequest,
  ProfileLite,
  Section,
  SectionChange,
  WindowRow
} from '../types'
import { buildSectionTree } from './buildSectionTree'
import { diffSections } from './diffSections'
import { pairSections } from './pairSections'
import { segmentSections } from './segmentSections'

/** A factory, not a constant: a shared `triggers` or `contributors` array that one
 *  caller sorted or pushed into would corrupt every later request in the process. */
const emptySummary = (): ChangeSummary => ({
  sectionsAdded: 0,
  sectionsRemoved: 0,
  sectionsModified: 0,
  wordsAdded: 0,
  wordsRemoved: 0,
  versions: 0,
  triggers: [],
  contributors: []
})

/**
 * Derived from the counts the response itself reports, so `changed: true` with a
 * zeroed summary cannot be built. Reading it off the byte compare instead marks
 * a window carrying only the editor's `toc-id` stamping pass as changed, and the
 * digest then mails "0 sections changed".
 */
const anyChanged = (summary: ChangeSummary): boolean =>
  summary.sectionsAdded + summary.sectionsRemoved + summary.sectionsModified > 0

const rollUp = (sections: SectionChange[], window: ChangeSummary): ChangeSummary => {
  const summary = { ...window }
  for (const section of sections) {
    if (section.status === 'added') summary.sectionsAdded += 1
    else if (section.status === 'removed') summary.sectionsRemoved += 1
    else if (section.status === 'modified') summary.sectionsModified += 1
    summary.wordsAdded += section.magnitude?.wordsAdded ?? 0
    summary.wordsRemoved += section.magnitude?.wordsRemoved ?? 0
  }
  return summary
}

/**
 * Read-only compute over two stored snapshots. The deps are a subset with no auth
 * middleware, so a separate process can import this factory by deep path instead
 * of calling the route. Nothing does today; the digest worker is issue #201.
 */
export const createComputeDocumentChanges = (deps: ComputeDeps): ComputeDocumentChanges => {
  const store = createChangesStore(deps.prisma)

  /** Attribution is decoration: a profile outage drops the names, never the request. */
  const resolveProfiles = async (rows: WindowRow[]): Promise<ProfileLite[]> => {
    const ids = distinctUserIds(rows)
    if (ids.length === 0) return []
    try {
      return await deps.getOwnerProfiles(ids)
    } catch (error) {
      deps.logger.warn({ err: error }, 'Change digest profile lookup failed')
      return []
    }
  }

  const windowSummary = async (
    documentId: string,
    afterVersion: number,
    toVersion: number
  ): Promise<ChangeSummary> => {
    const rows = await store.fetchWindow(documentId, afterVersion, toVersion)
    return {
      ...emptySummary(),
      versions: rows.length,
      triggers: [...new Set(rows.map((row) => row.trigger).filter((t): t is string => t !== null))],
      contributors: await resolveProfiles(rows)
    }
  }

  return async (request: ComputeRequest): Promise<ComputeOutcome> => {
    const startedAt = Date.now()
    const { documentId, since, until, scope } = request

    const meta = await store.findMeta(documentId)
    if (!meta || meta.deletedAt) return { ok: false, reason: 'not-found' }

    const [head, baseline] = await Promise.all([
      store.resolveAnchor(documentId, until),
      store.resolveAnchor(documentId, since)
    ])

    // One shape for every outcome, so `changed` cannot disagree with the counts
    // beside it.
    const respond = (
      outcome: string,
      anchors: { baseline: AnchorRef | null; head: AnchorRef | null },
      window: ChangeSummary,
      sections: SectionChange[]
    ): ComputeOutcome => {
      const summary = rollUp(sections, window)
      const changed = anyChanged(summary)
      deps.logger.info(
        { documentId, scope, outcome, changed, durationMs: Date.now() - startedAt },
        'Document changes computed'
      )
      return {
        ok: true,
        result: {
          documentId,
          since,
          until,
          ...anchors,
          changed,
          summary,
          ...(scope === 'headings' ? { sections: buildSectionTree(sections) } : {})
        }
      }
    }

    // Head null regardless of whether rows exist: an `until` before the first
    // save has nothing to report, and branching "no head means draft" would run
    // the attribution query against an undefined head version.
    if (!head) return respond('no-head', { baseline: null, head: null }, emptySummary(), [])

    const anchors = {
      baseline: baseline && { version: baseline.version, createdAt: baseline.createdAt },
      head: { version: head.version, createdAt: head.createdAt }
    }

    // Same row on both ends: nothing was saved in the window, so `versions: 0` is
    // exact truth and no query can add to it.
    if (baseline?.id === head.id) return respond('same-anchor', anchors, emptySummary(), [])

    const summary = await windowSummary(documentId, baseline?.version ?? 0, head.version)
    const ids = baseline ? [baseline.id, head.id] : [head.id]
    const rows = await store.fetchPairBytes(ids)
    // Retention can delete a row between resolving the anchor and reading it. The
    // document still exists, so this is not the same answer as a missing document.
    const headBytes = rows.find((row) => row.id === head.id)
    if (!headBytes) return { ok: false, reason: 'anchor-missing' }
    // Symmetric with the head row above. Treating a vanished baseline as "no
    // baseline" would mail a whole-document-new wall for an untouched document.
    const baselineBytes = baseline ? rows.find((row) => row.id === baseline.id) : undefined
    if (baseline && !baselineBytes) return { ok: false, reason: 'anchor-missing' }

    // A named checkpoint mints a row holding bytes identical to its predecessor.
    // Comparing them costs nothing and skips two decodes.
    if (baselineBytes && Buffer.compare(baselineBytes.data, headBytes.data) === 0) {
      return respond('identical-bytes', anchors, summary, [])
    }

    const headJson = readContent(headBytes.data, 'json')
    if (!headJson.ok) return { ok: false, reason: 'undecodable', error: headJson.error }
    let baselineSections: Section[] = []
    if (baselineBytes) {
      const baselineJson = readContent(baselineBytes.data, 'json')
      if (!baselineJson.ok) return { ok: false, reason: 'undecodable', error: baselineJson.error }
      baselineSections = segmentSections(baselineJson.content as TiptapDocJson)
    }

    const sections = diffSections(
      pairSections(baselineSections, segmentSections(headJson.content as TiptapDocJson)),
      (error, tocId) =>
        deps.logger.debug({ err: error, documentId, tocId }, 'Section magnitude failed')
    )
    return respond('computed', anchors, summary, sections)
  }
}
