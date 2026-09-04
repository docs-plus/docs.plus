/**
 * Real-infra E2E for the Document Changes API, `GET /api/documents/:id/changes`.
 * It drives real edits through REST → the WS process → BullMQ → Postgres, and it
 * also seeds rows straight through Prisma where a window needs timestamps the
 * live path cannot produce.
 *
 * Run as a standalone process, NOT `bun test`. BullMQ's worker run-loop does not
 * progress under the bun test runner. It works in a normal process, as in prod.
 * Needs the `make dev-local` docker services (Postgres + Redis) and root .env.local.
 */
import * as Y from 'yjs'

import { getMigrationSchema } from '../src/lib/migration-extensions'
import { pmJsonToYdocBytes } from '../src/lib/nested-flat-migration'
import { prisma } from '../src/lib/prisma'
import { closeQueues, createDocumentWorker } from '../src/lib/queue'
import { disconnectRedis } from '../src/lib/redis'
import {
  createTally,
  decodeText,
  deleteTestUser,
  makeOpenProvider,
  makeRest,
  mintTestUser,
  pollFor,
  type RestResponse,
  spawnServers,
  waitForHttp
} from './lib/e2eHarness'

const PREFIX = `e2e-changes-${Date.now()}`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required for the document-changes E2E')
  process.exit(1)
}

const { check, skip, outcome } = createTally()
const servers = spawnServers()
const { wsPort, internalPort } = servers
const rest = makeRest(servers.restUrl, SERVICE_KEY)
const openProvider = makeOpenProvider(wsPort)
type Json = Record<string, unknown>

const text = (value: string): Json => ({ type: 'text', text: value })

const para = (value: string): Json => ({ type: 'paragraph', content: [text(value)] })

const heading = (level: number, label: string, tocId?: string): Json => ({
  type: 'heading',
  attrs: { level, ...(tocId === undefined ? {} : { 'toc-id': tocId }) },
  content: [text(label)]
})

const doc = (...content: Json[]): Json => ({ type: 'doc', content })

const headingLabel = (node: Json): string => {
  const content = Array.isArray(node.content) ? node.content : []
  const first = content[0] as Json | undefined
  return typeof first?.text === 'string' ? first.text : ''
}

/** `toc-id` per heading text, so a `replace` can carry the server's ids forward.
 *  A replace that drops them reports every edit as one add plus one remove. */
const tocIdsByHeading = (content: unknown): Map<string, string> => {
  const ids = new Map<string, string>()
  if (!Array.isArray(content)) return ids
  for (const node of content as Json[]) {
    if (node?.type !== 'heading') continue
    const tocId = (node.attrs as Json | undefined)?.['toc-id']
    if (typeof tocId === 'string') ids.set(headingLabel(node), tocId)
  }
  return ids
}

const CYCLE_TITLE = 'Changes E2E title'

/** The scenario-1 document in its three states. Only plain text moves between
 *  them: the default token encoder reads no marks, so a bold toggle would
 *  correctly report a null magnitude and fail a word-delta assertion. */
const cycleDoc = (stage: 'base' | 'edited' | 'final', ids: Map<string, string>): Json => {
  const edited = stage !== 'base'
  return doc(
    heading(1, CYCLE_TITLE, ids.get(CYCLE_TITLE)),
    para('The title section body never changes in this run.'),
    heading(2, 'Alpha', ids.get('Alpha')),
    para(
      edited ? 'Rewritten alpha paragraph carrying several fresh words.' : 'Alpha original text.'
    ),
    heading(2, 'Beta', ids.get('Beta')),
    para('Beta body stays untouched for the whole run.'),
    heading(3, 'Beta detail', ids.get('Beta detail')),
    para(edited ? 'Rewritten beta detail paragraph with other words.' : 'Beta detail original.'),
    ...(stage === 'final'
      ? [heading(2, 'Delta'), para('Delta body arrives in the second patch.')]
      : [heading(2, 'Gamma', ids.get('Gamma')), para('Gamma body leaves in the second patch.')])
  )
}

const UNSTAMPED_TITLE = 'Imported title'

/** Scenario 3. The baseline is what an import writes: headings with no `toc-id`. */
const importedDoc = (stamped: boolean): Json => {
  const id = (suffix: string): string | undefined =>
    stamped ? `changes-e2e-toc-${suffix}` : undefined
  return doc(
    heading(1, UNSTAMPED_TITLE, id('title')),
    para('Title body from the import.'),
    heading(2, 'Import alpha', id('alpha')),
    para('Import alpha body.'),
    heading(2, 'Import beta', id('beta')),
    para(stamped ? 'Import beta body rewritten by the editor.' : 'Import beta body.'),
    heading(3, 'Import beta detail', id('detail')),
    para('Import beta detail body.'),
    heading(2, 'Import gamma', id('gamma')),
    para('Import gamma body.')
  )
}

/** Scenario 5. `marker` keeps consecutive rows apart so no pair is byte-equal. */
const anchorDoc = (marker: string, withLater: boolean): Json =>
  doc(
    heading(1, 'Anchor document', 'changes-e2e-anchor-title'),
    para(`Anchor body ${marker}.`),
    ...(withLater
      ? [heading(2, 'Later section', 'changes-e2e-anchor-later'), para('Later body.')]
      : [])
  )

const createdDocumentIds: string[] = []

const createDocument = async (
  suffix: string,
  extra: Record<string, unknown> = {}
): Promise<{ documentId: string; slug: string; title: string }> => {
  const slug = `${PREFIX}-${suffix}`
  const { status, body } = await rest('/api/documents', {
    method: 'POST',
    body: JSON.stringify({ title: `Title ${suffix}`, slug, ...extra })
  })
  if (status !== 200) throw new Error(`create ${suffix} failed: ${status} ${JSON.stringify(body)}`)
  createdDocumentIds.push(body.data.documentId)
  return { documentId: body.data.documentId, slug: body.data.slug, title: body.data.title }
}

/** `.check()` is the only content-expression gate: `toYdoc` uses `Node.fromJSON`,
 *  which never runs one, so an invalid fixture would encode and round-trip clean. */
const snapshotBytes = (json: Json): Uint8Array<ArrayBuffer> => {
  getMigrationSchema().nodeFromJSON(json).check()
  // Re-wrapped because Prisma's `Bytes` is `Uint8Array<ArrayBuffer>`, and a bare
  // `Uint8Array` annotation widens to `ArrayBufferLike`, which it refuses.
  return new Uint8Array(pmJsonToYdocBytes(json))
}

/** `version` and `createdAt` are both explicit. The `@default(1)` collides on the
 *  second row, and `resolveAnchor` orders on `createdAt`, which `now()` cannot space. */
const seedRow = (documentId: string, version: number, createdAt: Date, json: Json) =>
  prisma.documents.create({
    data: {
      documentId,
      version,
      data: snapshotBytes(json),
      commitMessage: '',
      trigger: 'api',
      triggeredBy: null,
      contributors: [],
      createdAt
    }
  })

const headRow = (documentId: string) =>
  prisma.documents.findFirst({
    where: { documentId },
    orderBy: { version: 'desc' },
    select: { version: true, createdAt: true, data: true, commitMessage: true }
  })

const rowAt = (documentId: string, version: number) =>
  prisma.documents.findFirst({
    where: { documentId, version },
    select: { version: true, createdAt: true, data: true }
  })

const appendParagraph = (ydoc: Y.Doc, value: string): void => {
  const fragment = ydoc.getXmlFragment('default')
  const paragraph = new Y.XmlElement('paragraph')
  paragraph.insert(0, [new Y.XmlText(value)])
  fragment.insert(fragment.length, [paragraph])
}

interface ResponseSection {
  tocId: string | null
  text: string
  level: number
  status: 'added' | 'removed' | 'modified' | 'unchanged'
  magnitude: {
    wordsAdded: number
    wordsRemoved: number
    blocksBefore: number
    blocksAfter: number
  } | null
  excerpt?: string
  children: ResponseSection[]
}

interface ChangesData {
  documentId: string
  since: string
  until: string
  baseline: { version: number; createdAt: string } | null
  head: { version: number; createdAt: string } | null
  changed: boolean
  summary: {
    sectionsAdded: number
    sectionsRemoved: number
    sectionsModified: number
    wordsAdded: number
    wordsRemoved: number
    versions: number
    triggers: string[]
    contributors: { id: string }[]
  }
  sections?: ResponseSection[]
}

/** `URLSearchParams`, never a template string: Hono turns a raw `+` in a query
 *  value into a space, so an instant carrying a numeric offset fails validation. */
const changes = (
  documentId: string,
  params: { since: Date; until?: Date; scope?: 'summary' | 'headings' },
  init: { auth?: string | null } = {}
): Promise<RestResponse> => {
  const query = new URLSearchParams({ since: params.since.toISOString() })
  if (params.until !== undefined) query.set('until', params.until.toISOString())
  if (params.scope !== undefined) query.set('scope', params.scope)
  return rest(`/api/documents/${documentId}/changes?${query.toString()}`, init)
}

const justAfter = (at: Date): Date => new Date(at.getTime() + 1)

/** Every count and sum runs over this list. Summing the roots alone under-counts:
 *  `rollUp` folds the flat pairing, and one h1 root hides its whole outline. */
const flatten = (nodes: ResponseSection[]): ResponseSection[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)])

const findWithParent = (
  nodes: ResponseSection[],
  label: string,
  parent: ResponseSection | null = null
): { node: ResponseSection; parent: ResponseSection | null } | null => {
  for (const node of nodes) {
    if (node.text === label) return { node, parent }
    const hit = findWithParent(node.children, label, node)
    if (hit) return hit
  }
  return null
}

const statusOf = (nodes: ResponseSection[], label: string): string =>
  findWithParent(nodes, label)?.node.status ?? 'missing'

const sorted = (values: string[]): string => [...values].sort().join(',')

const cleanup = async () => {
  await prisma.documentMetadata.deleteMany({ where: { slug: { startsWith: 'e2e-changes-' } } })
  if (createdDocumentIds.length > 0) {
    await prisma.documents.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  }
}

console.log('E2E: document changes (real REST + WS + Redis + Postgres)')
await cleanup()

const worker = createDocumentWorker()
await worker.waitUntilReady()

if (!(await waitForHttp(`http://127.0.0.1:${internalPort}/metrics`))) {
  console.error('WS process internal listener never came up')
  servers.kill()
  process.exit(1)
}
if (!(await waitForHttp(`${servers.restUrl}/health`))) {
  console.error('REST process never came up')
  servers.kill()
  process.exit(1)
}

const actor = await mintTestUser(PREFIX, SERVICE_KEY, 'Changes Actor')

try {
  console.log('\n[1] a real edit cycle')
  {
    const document = await createDocument('cycle', { content: cycleDoc('base', new Map()) })

    const created = await headRow(document.documentId)
    if (!created) throw new Error('create-with-content wrote no version row')
    check(created.version === 1, `the create wrote version 1 (got ${created.version})`)
    // T1, one millisecond after the row Postgres timestamped. Both ends of every
    // window come from a row read back, never from the script's own clock.
    const since = justAfter(created.createdAt)

    const read = await rest(`/api/documents/${document.documentId}/content`)
    check(read.status === 200, `the content read returned 200 (got ${read.status})`)
    const ids = tocIdsByHeading(read.body?.data?.content?.content)
    check(ids.size === 5, `the create stamped a toc-id on all five headings (got ${ids.size})`)

    const first = await rest(`/api/documents/${document.documentId}/content?mode=replace`, {
      method: 'PATCH',
      body: JSON.stringify({ content: cycleDoc('edited', ids) })
    })
    check(first.status === 200, `the first PATCH returned 200 (got ${first.status})`)
    const edited = await pollFor(
      () => headRow(document.documentId),
      (row) => decodeText(row.data).includes('Rewritten alpha paragraph')
    )
    check(!!edited, 'the two rewritten sections persisted')

    const second = await rest(`/api/documents/${document.documentId}/content?mode=replace`, {
      method: 'PATCH',
      body: JSON.stringify({ content: cycleDoc('final', ids) })
    })
    check(second.status === 200, `the second PATCH returned 200 (got ${second.status})`)
    const head = await pollFor(
      () => headRow(document.documentId),
      (row) => decodeText(row.data).includes('Delta body arrives')
    )
    check(!!head, 'the added and removed sections persisted')
    if (!head) throw new Error('the edit cycle never reached the database')
    const until = justAfter(head.createdAt)

    const response = await changes(document.documentId, { since, until, scope: 'headings' })
    check(response.status === 200, `the changes read returned 200 (got ${response.status})`)
    const data = response.body?.data as ChangesData
    const sections = data?.sections ?? []

    check(data?.changed === true, 'the window reports changed')
    check(
      data?.baseline?.version === 1,
      `the baseline is version 1 (got ${data?.baseline?.version})`
    )
    check(
      data?.head?.version === head.version,
      `the head is the row that landed last (got ${data?.head?.version})`
    )

    check(sections.length === 1, `the tree has one root, the title (got ${sections.length})`)
    check(sections[0]?.text === CYCLE_TITLE, 'the root is the level-1 title section')
    check(sections[0]?.level === 1, 'the root carries level 1')
    check(
      flatten(sections).length === 6,
      `six sections in the tree (got ${flatten(sections).length})`
    )

    const alpha = findWithParent(sections, 'Alpha')
    check(alpha?.node.status === 'modified', `Alpha is modified (got ${alpha?.node.status})`)
    check(alpha?.parent?.text === CYCLE_TITLE, 'Alpha nests under the title, not at the root')
    check((alpha?.node.magnitude?.wordsAdded ?? 0) > 0, 'Alpha reports words added')
    check((alpha?.node.magnitude?.wordsRemoved ?? 0) > 0, 'Alpha reports words removed')

    const detail = findWithParent(sections, 'Beta detail')
    check(
      detail?.node.status === 'modified',
      `Beta detail is modified (got ${detail?.node.status})`
    )
    check(detail?.parent?.text === 'Beta', 'Beta detail nests under Beta, not under the title')
    check(detail?.node.level === 3, 'Beta detail carries level 3')
    check((detail?.node.magnitude?.wordsAdded ?? 0) > 0, 'Beta detail reports words added')
    check((detail?.node.magnitude?.wordsRemoved ?? 0) > 0, 'Beta detail reports words removed')

    const beta = findWithParent(sections, 'Beta')
    check(beta?.node.status === 'unchanged', `Beta is unchanged (got ${beta?.node.status})`)
    check(beta?.node.magnitude === null, 'an unchanged section carries no magnitude')
    check(statusOf(sections, CYCLE_TITLE) === 'unchanged', 'the title section is unchanged')

    const delta = findWithParent(sections, 'Delta')
    check(delta?.node.status === 'added', `Delta is added (got ${delta?.node.status})`)
    check(delta?.parent?.text === CYCLE_TITLE, 'Delta nests under the title')
    check((delta?.node.magnitude?.wordsAdded ?? 0) > 0, 'Delta reports every word as added')
    check(delta?.node.magnitude?.wordsRemoved === 0, 'Delta removed nothing')
    // The only place an excerpt is read back after the real encode, the Postgres
    // `Bytes` round trip and the JSON response.
    check(
      delta?.node.excerpt === 'Delta body arrives in the second patch.',
      `Delta carries its body as the excerpt (got ${JSON.stringify(delta?.node.excerpt)})`
    )

    const gamma = findWithParent(sections, 'Gamma')
    check(gamma?.node.status === 'removed', `Gamma is removed (got ${gamma?.node.status})`)
    check(gamma?.parent?.text === CYCLE_TITLE, 'the removed Gamma still nests under the title')
    check((gamma?.node.magnitude?.wordsRemoved ?? 0) > 0, 'Gamma reports every word as removed')
    check(gamma?.node.excerpt === undefined, 'a removed section carries no excerpt')

    // Only these five fields roll up from `sections`. `versions`, `triggers` and
    // `contributors` come from a separate window query and never equal a count.
    const flat = flatten(sections)
    const rolled = {
      sectionsAdded: flat.filter((node) => node.status === 'added').length,
      sectionsRemoved: flat.filter((node) => node.status === 'removed').length,
      sectionsModified: flat.filter((node) => node.status === 'modified').length,
      wordsAdded: flat.reduce((total, node) => total + (node.magnitude?.wordsAdded ?? 0), 0),
      wordsRemoved: flat.reduce((total, node) => total + (node.magnitude?.wordsRemoved ?? 0), 0)
    }
    check(
      data?.summary.sectionsAdded === 1,
      `summary counts one added (got ${data?.summary.sectionsAdded})`
    )
    check(
      data?.summary.sectionsRemoved === 1,
      `summary counts one removed (got ${data?.summary.sectionsRemoved})`
    )
    check(
      data?.summary.sectionsModified === 2,
      `summary counts two modified (got ${data?.summary.sectionsModified})`
    )
    check(
      data?.summary.sectionsAdded === rolled.sectionsAdded &&
        data?.summary.sectionsRemoved === rolled.sectionsRemoved &&
        data?.summary.sectionsModified === rolled.sectionsModified,
      'the summary section counts equal the sums over the flattened tree'
    )
    check(
      data?.summary.wordsAdded === rolled.wordsAdded &&
        data?.summary.wordsRemoved === rolled.wordsRemoved,
      'the summary word counts equal the sums over the flattened tree'
    )
    check(
      data?.summary.versions === head.version - 1,
      `the window counts every row after the baseline (got ${data?.summary.versions})`
    )
    check(sorted(data?.summary.triggers ?? []) === 'api', 'both patched rows are api-triggered')

    // `summary` is computed before the scope branch, so the two scopes must agree.
    const plain = await changes(document.documentId, { since, until, scope: 'summary' })
    const plainData = plain.body?.data as ChangesData
    check(plain.status === 200, `the summary-scope read returned 200 (got ${plain.status})`)
    check(plainData?.sections === undefined, 'scope=summary omits the sections key entirely')
    check(
      plainData?.summary.sectionsAdded === data?.summary.sectionsAdded &&
        plainData?.summary.sectionsRemoved === data?.summary.sectionsRemoved &&
        plainData?.summary.sectionsModified === data?.summary.sectionsModified &&
        plainData?.summary.wordsAdded === data?.summary.wordsAdded &&
        plainData?.summary.wordsRemoved === data?.summary.wordsRemoved &&
        plainData?.summary.versions === data?.summary.versions,
      'the two scopes report the same summary'
    )
    check(
      sorted(plainData?.summary.triggers ?? []) === sorted(data?.summary.triggers ?? []),
      'the two scopes report the same triggers'
    )

    // A collaborator's own edit is the only row carrying a real user id, so this
    // is where `contributors` can be proved at all.
    if (!actor) {
      skip('no verifiable Supabase session; summary.contributors cannot name the editor')
    } else {
      const session = await openProvider(document.documentId, document.slug, actor.accessToken)
      check(session.synced, 'the signed-in collaborator synced against the real WS server')
      appendParagraph(session.ydoc, 'contributor-paragraph')
      // destroy() is the last connection closing, which flushes the pending
      // debounced store immediately instead of waiting out the 10s window.
      session.provider.destroy()

      const wsRow = await pollFor(
        () =>
          prisma.documents.findFirst({
            where: { documentId: document.documentId, trigger: 'websocket' },
            orderBy: { version: 'desc' },
            select: { version: true, createdAt: true, triggeredBy: true }
          }),
        () => true
      )
      check(!!wsRow, 'the collaborator edit persisted as a websocket-triggered version')
      if (wsRow) {
        const widened = await changes(document.documentId, {
          since,
          until: justAfter(wsRow.createdAt),
          scope: 'summary'
        })
        const widenedData = widened.body?.data as ChangesData
        check(
          sorted(widenedData?.summary.triggers ?? []) === 'api,websocket',
          'the widened window lists both triggers'
        )
        // The skip is reachable only with no verifiable session. With a real
        // actor and a landed websocket row, an empty `contributors` is the
        // profile-lookup outage this group exists to catch, so it must fail.
        const named = widenedData?.summary.contributors ?? []
        check(
          named.some((profile) => profile.id === actor.id),
          `the editor is listed among the window contributors (got ${named.length} name(s))`
        )
      }
    }
  }

  // 2. An empty window. Two paths reach `changed: false` and only `versions`
  //    tells them apart, so both are pinned.
  console.log('\n[2] an empty window')
  {
    const document = await createDocument('empty', { content: cycleDoc('base', new Map()) })
    const first = await headRow(document.documentId)
    if (!first) throw new Error('create-with-content wrote no version row')

    const at = justAfter(first.createdAt)
    const same = await changes(document.documentId, { since: at, until: at, scope: 'headings' })
    const sameData = same.body?.data as ChangesData
    check(same.status === 200, `the same-anchor read returned 200 (got ${same.status})`)
    check(sameData?.changed === false, 'a window with no edits reports changed: false')
    check(Array.isArray(sameData?.sections), 'scope=headings still carries a sections key')
    check(sameData?.sections?.length === 0, 'the sections array is empty')
    check(
      sameData?.summary.versions === 0,
      `same-anchor reports zero versions (got ${sameData?.summary.versions})`
    )
    // Each end is pinned to the row, never to the other end. `null?.version` is
    // `undefined` on both sides, so comparing them also holds on the `no-head`
    // path, where the response names no row at all.
    check(
      sameData?.baseline?.version === first.version,
      `the baseline is version ${first.version} (got ${sameData?.baseline?.version})`
    )
    check(
      sameData?.head?.version === first.version,
      `the head is the same row (got ${sameData?.head?.version})`
    )
    check(
      sameData?.summary.wordsAdded === 0 && sameData?.summary.wordsRemoved === 0,
      'no words moved'
    )

    // The only call in this run that omits `until` and `scope`, so it is the
    // only place their defaults are exercised.
    const askedAt = new Date()
    const defaults = await changes(document.documentId, { since: at })
    const defaultsData = defaults.body?.data as ChangesData
    check(defaults.status === 200, `the defaults read returned 200 (got ${defaults.status})`)
    check(defaultsData?.sections === undefined, 'scope defaults to summary, so sections is absent')
    check(defaultsData?.documentId === document.documentId, 'the response echoes the documentId')
    check(
      new Date(defaultsData?.since ?? 0).getTime() === at.getTime(),
      'the response echoes the requested since'
    )
    check(
      new Date(defaultsData?.until ?? 0).getTime() >= askedAt.getTime(),
      'until defaulted to the request instant, not to a frozen date'
    )

    // The `no-head` arm: an `until` before the first row ever written. Both
    // anchors come back null, and no attribution query may run against an
    // undefined head version.
    const preHistory = await changes(document.documentId, {
      since: new Date(first.createdAt.getTime() - 120_000),
      until: new Date(first.createdAt.getTime() - 60_000),
      scope: 'headings'
    })
    const preData = preHistory.body?.data as ChangesData
    check(preHistory.status === 200, `the pre-history read returned 200 (got ${preHistory.status})`)
    check(preData?.head === null, 'no row exists at or before that until, so head is null')
    check(preData?.baseline === null, 'the baseline is null on the same window')
    check(preData?.changed === false, 'a window before the document existed reports no change')
    check(preData?.sections?.length === 0, 'the sections array is empty')
    check(
      preData?.summary.versions === 0,
      `no rows entered the window (got ${preData?.summary.versions})`
    )

    // A checkpoint mints a named row over the same content, which is the only
    // caller-reachable route into the byte-equal path.
    const checkpoint = await rest(`/api/documents/${document.documentId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Changes E2E checkpoint' })
    })
    check(checkpoint.status === 200, `the checkpoint returned 200 (got ${checkpoint.status})`)
    const named = await pollFor(
      () => headRow(document.documentId),
      (row) => row.commitMessage === 'Changes E2E checkpoint'
    )
    check(!!named, 'the checkpoint minted a named version')

    if (named && named.createdAt.getTime() <= first.createdAt.getTime()) {
      skip('the checkpoint shares its predecessor millisecond; no instant separates the two rows')
    } else if (named) {
      const second = await changes(document.documentId, {
        since: first.createdAt,
        until: justAfter(named.createdAt),
        scope: 'headings'
      })
      const secondData = second.body?.data as ChangesData
      check(second.status === 200, `the checkpoint window returned 200 (got ${second.status})`)
      check(secondData?.baseline?.version === first.version, 'the baseline is the row before it')
      check(secondData?.head?.version === named.version, 'the head is the checkpoint row')
      check(secondData?.changed === false, 'a checkpoint over the same content is not a change')
      check(
        secondData?.summary.versions === 1,
        `one row entered the window (got ${secondData?.summary.versions})`
      )
      // Byte-equal short-circuits before any decode and answers with no sections.
      // Unequal bytes still decode to the same outline, so every pair is unchanged.
      const byteEqual = Buffer.compare(first.data, named.data) === 0
      const nodes = flatten(secondData?.sections ?? [])
      check(
        byteEqual
          ? nodes.length === 0
          : nodes.length > 0 && nodes.every((node) => node.status === 'unchanged'),
        byteEqual
          ? 'byte-equal rows answer with no sections at all'
          : 'the re-encoded checkpoint decodes to the same outline, every section unchanged'
      )
    }
  }

  // 3. An unstamped baseline. `canonicalizeBlock` drops `toc-id`, so the first
  //    stamping pass must not read as a whole-document rewrite.
  console.log('\n[3] an unstamped baseline')
  {
    const document = await createDocument('unstamped')
    const baselineAt = new Date(Date.now() - 10 * 60 * 1000)
    const headAt = new Date(Date.now() - 5 * 60 * 1000)
    await seedRow(document.documentId, 1, baselineAt, importedDoc(false))
    await seedRow(document.documentId, 2, headAt, importedDoc(true))

    const response = await changes(document.documentId, {
      since: baselineAt,
      until: new Date(),
      scope: 'headings'
    })
    const data = response.body?.data as ChangesData
    const sections = data?.sections ?? []
    const nodes = flatten(sections)

    check(response.status === 200, `the unstamped window returned 200 (got ${response.status})`)
    check(data?.baseline?.version === 1, 'the unstamped row is the baseline')
    check(data?.head?.version === 2, 'the stamped row is the head')
    check(nodes.length === 5, `all five sections are reported (got ${nodes.length})`)
    check(
      nodes.filter((node) => node.status === 'added').length === 0,
      'no section is reported as added — the stamping pass is not a whole-document wall'
    )
    check(data?.summary.sectionsAdded === 0, 'the summary counts no additions')
    check(data?.summary.sectionsRemoved === 0, 'the summary counts no removals')
    check(
      data?.summary.sectionsModified === 1,
      `only the edited section is modified (got ${data?.summary.sectionsModified})`
    )
    check(statusOf(sections, UNSTAMPED_TITLE) === 'unchanged', 'the unedited title is unchanged')
    check(statusOf(sections, 'Import alpha') === 'unchanged', 'an unedited section is unchanged')
    check(statusOf(sections, 'Import gamma') === 'unchanged', 'the last section is unchanged')
    check(statusOf(sections, 'Import beta') === 'modified', 'only the edited section is modified')
    check(
      findWithParent(sections, 'Import beta detail')?.parent?.text === 'Import beta',
      'the level-3 section still nests under its level-2 parent'
    )
    check(
      data?.summary.versions === 1,
      `one row entered the window (got ${data?.summary.versions})`
    )
  }

  console.log('\n[4] the gates')
  {
    const document = await createDocument('gates', { content: cycleDoc('base', new Map()) })
    const created = await headRow(document.documentId)
    if (!created) throw new Error('create-with-content wrote no version row')
    const since = created.createdAt
    const until = justAfter(created.createdAt)

    const anonymous = await changes(document.documentId, { since, until }, { auth: null })
    check(anonymous.status === 401, `no bearer returned 401 (got ${anonymous.status})`)
    check(
      anonymous.body?.error?.code === 'UNAUTHORIZED',
      'the 401 carries the house UNAUTHORIZED envelope'
    )

    // This route is requireServiceRole only, so a wrong key is an unambiguous
    // 401 and never falls through to a Supabase user check.
    const wrong = await changes(document.documentId, { since, until }, { auth: 'not-the-key' })
    check(wrong.status === 401, `a wrong bearer returned 401 (got ${wrong.status})`)

    // A bad key and a malformed `since` can answer only one of 401 or 400, and
    // which one it is says which middleware ran first.
    const bothWrong = await rest(`/api/documents/${document.documentId}/changes?since=not-a-date`, {
      auth: 'not-the-key'
    })
    check(
      bothWrong.status === 401,
      `a bad key with a malformed since answers 401, not 400 (got ${bothWrong.status})`
    )

    // The one 400 cause a caller reaches without hand-writing a query string.
    const reversed = await changes(document.documentId, {
      since: justAfter(created.createdAt),
      until: created.createdAt
    })
    check(reversed.status === 400, `a reversed window returned 400 (got ${reversed.status})`)
    check(
      reversed.body?.error?.code === 'VALIDATION_ERROR',
      'the 400 carries the house VALIDATION_ERROR envelope'
    )

    await prisma.documentMetadata.update({
      where: { documentId: document.documentId },
      data: { deletedAt: new Date() }
    })
    const tombstoned = await changes(document.documentId, { since, until })
    check(
      tombstoned.status === 404,
      `a tombstoned document returned 404 (got ${tombstoned.status})`
    )
    check(
      tombstoned.body?.error?.code === 'NOT_FOUND',
      'the 404 carries the house NOT_FOUND envelope'
    )

    // Without this, a regression that swallowed the decode error and answered
    // 200 with an empty `sections` array would pass every check above.
    const corrupt = await createDocument('corrupt')
    const intact = snapshotBytes(anchorDoc('intact', true))
    await seedRow(corrupt.documentId, 1, new Date(Date.now() - 60_000), anchorDoc('intact', true))
    await prisma.documents.create({
      data: {
        documentId: corrupt.documentId,
        version: 2,
        // Truncated rather than a hand-picked constant. Six zero bytes are a
        // valid empty v1 update, so they decode clean and the route answers 200.
        // A cut real update leaves the decoder reading past the end. Measured.
        data: intact.slice(0, 6),
        commitMessage: '',
        trigger: 'api',
        triggeredBy: null,
        contributors: [],
        createdAt: new Date()
      }
    })
    const undecodable = await changes(corrupt.documentId, {
      since: new Date(Date.now() - 120_000),
      until: new Date()
    })
    check(
      undecodable.status === 500,
      `an undecodable snapshot returned 500 (got ${undecodable.status})`
    )
    check(
      undecodable.body?.error?.code === 'INTERNAL_SERVER_ERROR',
      'the 500 carries the house INTERNAL_SERVER_ERROR envelope'
    )

    console.log('    note: the other 404, `anchor-missing`, needs retention to delete a row')
    console.log('    between `resolveAnchor` and `fetchPairBytes` inside one request. No')
    console.log('    external caller can force that window, so this run does not cover it.')
  }

  console.log('\n[5] the anchor actually used')
  console.log('    Correction to the issue text. It asks for a `since` older than the')
  console.log('    retention floor whose `baseline.createdAt` echoes the row used as the')
  console.log('    anchor. `resolveAnchor` filters `createdAt <= since`, so such a `since`')
  console.log('    matches no row at all and `baseline` is null. There is then nothing to')
  console.log('    echo. 5a pins the `lte` rule and the `version desc` tiebreak instead.')
  console.log('    5b pins the null baseline, which reports the whole document as added.')
  {
    const document = await createDocument('anchor')
    const now = Date.now()
    const firstAt = new Date(now - 30 * 60 * 1000)
    const secondAt = new Date(now - 20 * 60 * 1000)
    const sharedAt = new Date(now - 10 * 60 * 1000)
    await seedRow(document.documentId, 1, firstAt, anchorDoc('one', false))
    await seedRow(document.documentId, 2, secondAt, anchorDoc('two', false))
    await seedRow(document.documentId, 3, sharedAt, anchorDoc('three', true))
    // Two rows inside one TIMESTAMP(3) value, which is the P2002-healed retry the
    // `version desc` tiebreak exists for.
    await seedRow(document.documentId, 4, sharedAt, anchorDoc('four', true))

    const seededFirst = await rowAt(document.documentId, 1)
    if (!seededFirst) throw new Error('the seeded anchor rows are missing')

    console.log('  5a — a since strictly between two rows')
    const sinceBetween = new Date(now - 25 * 60 * 1000)
    const untilBetween = new Date(now - 15 * 60 * 1000)
    const middle = await changes(document.documentId, {
      since: sinceBetween,
      until: untilBetween,
      scope: 'summary'
    })
    const middleData = middle.body?.data as ChangesData
    check(middle.status === 200, `the mid-window read returned 200 (got ${middle.status})`)
    check(
      middleData?.baseline?.version === 1,
      `the baseline is the older row, not the newer one (got ${middleData?.baseline?.version})`
    )
    check(
      middleData?.head?.version === 2,
      `the head is version 2 (got ${middleData?.head?.version})`
    )
    check(
      new Date(middleData?.baseline?.createdAt ?? 0).getTime() === seededFirst.createdAt.getTime(),
      'baseline.createdAt echoes the row the anchor resolved to'
    )
    check(
      new Date(middleData?.baseline?.createdAt ?? 0).getTime() !== sinceBetween.getTime(),
      'baseline.createdAt is the row instant, never the requested instant'
    )
    check(
      middleData?.summary.versions === 1,
      `one row sits inside the window (got ${middleData?.summary.versions})`
    )

    const tie = await changes(document.documentId, {
      since: sharedAt,
      until: sharedAt,
      scope: 'summary'
    })
    const tieData = tie.body?.data as ChangesData
    check(tie.status === 200, `the tiebreak read returned 200 (got ${tie.status})`)
    check(
      tieData?.baseline?.version === 4,
      `two rows share one instant and the higher version wins (got ${tieData?.baseline?.version})`
    )
    check(tieData?.head?.version === 4, 'the head resolves to the same row')

    console.log('  5b — a since before every row of the document')
    const ancient = new Date(now - 60 * 60 * 1000)
    const whole = await changes(document.documentId, {
      since: ancient,
      until: new Date(),
      scope: 'headings'
    })
    const wholeData = whole.body?.data as ChangesData
    const nodes = flatten(wholeData?.sections ?? [])
    check(whole.status === 200, `the pre-history read returned 200 (got ${whole.status})`)
    check(wholeData?.baseline === null, 'a since before every row resolves to a null baseline')
    check(wholeData?.head?.version === 4, 'the head is still the newest row')
    check(wholeData?.changed === true, 'the whole document reads as new')
    check(nodes.length === 2, `both head sections are reported (got ${nodes.length})`)
    check(
      nodes.every((node) => node.status === 'added'),
      'every section is added — nothing existed at that instant'
    )
    check(
      wholeData?.summary.sectionsAdded === 2 &&
        wholeData?.summary.sectionsRemoved === 0 &&
        wholeData?.summary.sectionsModified === 0,
      'the summary reports two additions and nothing else'
    )
    // A null baseline lowers the window bound to version 0, so the count spans
    // the whole surviving history rather than the requested window.
    check(
      wholeData?.summary.versions === 4,
      `the version count spans the whole history (got ${wholeData?.summary.versions})`
    )
  }
} catch (error) {
  console.error('\nE2E aborted:', error)
  // Routed through `check` so an abort reaches the same failure counter the
  // assertions use, and the exit code has one source.
  check(false, 'the run completed without throwing')
} finally {
  await deleteTestUser(actor, SERVICE_KEY)
  await cleanup()
  servers.kill()
  await worker.close()
  await closeQueues()
  await prisma.$disconnect()
  await disconnectRedis()
}

const { failed, skipped } = outcome()
if (skipped > 0) console.log(`\n${skipped} check group(s) skipped`)
console.log(failed ? '\ndocument changes E2E: FAILED' : '\ndocument changes E2E: PASSED')
process.exit(failed ? 1 : 0)
