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
  SectionChange,
  WindowRow
} from '../types'
import { buildSectionTree } from './buildSectionTree'
import { compareDocs, noSectionChanges } from './compareDocs'

/** A factory, not a constant: a shared `triggers` or `contributors` array that one
 *  caller sorted or pushed into would corrupt every later request in the process. */
const emptySummary = (): ChangeSummary => ({
  ...noSectionChanges(),
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
  summary.sectionsAdded +
    summary.sectionsRemoved +
    summary.sectionsModified +
    summary.sectionsMoved >
  0

/**
 * Read-only compute over two stored snapshots. The deps are a subset with no auth
 * middleware, so the digest worker imports this factory by deep path.
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
      summary: ChangeSummary,
      sections: SectionChange[]
    ): ComputeOutcome => {
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
    let baselineJson: TiptapDocJson | null = null
    if (baselineBytes) {
      const read = readContent(baselineBytes.data, 'json')
      if (!read.ok) return { ok: false, reason: 'undecodable', error: read.error }
      baselineJson = read.content as TiptapDocJson
    }

    const { sections, counts } = compareDocs(
      baselineJson,
      headJson.content as TiptapDocJson,
      (error, tocId) =>
        deps.logger.warn({ err: error, documentId, tocId }, 'Section magnitude failed')
    )
    // The window carries zero counts, so the compared counts replace them.
    return respond('computed', anchors, { ...summary, ...counts }, sections)
  }
}
