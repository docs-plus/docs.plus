/**
 * Real-infra check for the duplicate ↔ purge media contract: a duplicate re-hosts only
 * the objects its snapshot names, and purging the source leaves the copy whole.
 * Run: bun run test:e2e:duplicate-media (needs `make dev-local` and root .env.local).
 */
import { TiptapTransformer } from '@hocuspocus/transformer'
import { readdir, rm } from 'fs/promises'
import * as Y from 'yjs'

import {
  duplicateDocument,
  permanentlyDeleteDocument,
  softDeleteDocument
} from '../src/api/services/documents.service'
import { uploadMedia } from '../src/api/services/media.service'
import { migrationExtensions } from '../src/lib/migration-extensions'
import { prisma } from '../src/lib/prisma'
import { getServiceRoleClient } from '../src/lib/supabase'

// `PERSIST_TO_LOCAL_STORAGE=true` is forced by the package script, not here: the
// storage pick is read from validated config, which is frozen at import, so an
// assignment in this file would land too late. Without it the purge below would
// delete-by-prefix against the live bucket named by `DO_STORAGE_ENDPOINT`.

const OWNER = 'e2e-dup-media-owner'
const MEDIA_ROOT = './temp/hypermultimedia'
const MEDIA_ROUTE = 'https://e2e.invalid/api/plugins/hypermultimedia'

let passed = 0
let failed = 0
const check = (condition: boolean, message: string) => {
  console.log(`  ${condition ? '✓' : '✗'} ${message}`)
  if (condition) passed += 1
  else failed += 1
}

if (!getServiceRoleClient()) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required — the footprint purge RPC is service-role')
  process.exit(1)
}

const documentIds: string[] = []

interface Seed {
  documentId: string
  /** Everything stored under the source's prefix. */
  fileNames: string[]
  /** The subset the snapshot names — the only objects a duplicate may copy. */
  referenced: string[]
  /** Stored but named by no node: the object a deleted media node left behind. */
  unreferenced: string
}

const listObjects = async (documentId: string): Promise<string[]> => {
  try {
    return (await readdir(`${MEDIA_ROOT}/${documentId}`)).sort()
  } catch {
    return []
  }
}

/** Every place a media URL can hide: an element attribute (the image node's
 *  `src`) and a mark attribute (a chat file attachment's hyperlink `href`). */
const collectMediaUrls = (node: unknown): { nodeAttrs: string[]; markAttrs: string[] } => {
  const nodeAttrs: string[] = []
  const markAttrs: string[] = []
  const walk = (current: any) => {
    if (!current || typeof current !== 'object') return
    if (typeof current.attrs?.src === 'string') nodeAttrs.push(current.attrs.src)
    for (const mark of current.marks ?? []) {
      if (typeof mark?.attrs?.href === 'string') markAttrs.push(mark.attrs.href)
    }
    for (const child of current.content ?? []) walk(child)
  }
  walk(node)
  return { nodeAttrs, markAttrs }
}

const readStoredUrls = async (documentId: string) => {
  const row = await prisma.documents.findFirst({
    where: { documentId },
    orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
    select: { data: true }
  })
  if (!row) return null
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, row.data)
  return collectMediaUrls(TiptapTransformer.fromYdoc(ydoc, 'default'))
}

const createMetadata = async (documentId: string) => {
  documentIds.push(documentId)
  await prisma.documentMetadata.create({
    data: {
      documentId,
      slug: documentId,
      title: documentId,
      description: '',
      keywords: '',
      ownerId: OWNER
    }
  })
}

const nameOf = (fileAddress: string): string => fileAddress.split('/').pop() as string

/** Three stored objects; the snapshot names two — one through an image node's
 *  `src`, one through a hyperlink mark's `href`. The third stands for a media node
 *  the author deleted: removing the node never deleted the object. */
const seed = async (suffix: string): Promise<Seed> => {
  const documentId = `e2e-dup-${Date.now()}-${suffix}`
  await createMetadata(documentId)

  const png = await uploadMedia(
    documentId,
    new File([new Uint8Array([137, 80, 78, 71])], 'pixel.png', { type: 'image/png' })
  )
  const pdf = await uploadMedia(
    documentId,
    new File([new Uint8Array([37, 80, 68, 70])], 'notes.pdf', { type: 'application/pdf' })
  )
  const orphan = await uploadMedia(
    documentId,
    new File([new Uint8Array([71, 73, 70, 56])], 'deleted.gif', { type: 'image/gif' })
  )

  const ydoc = TiptapTransformer.toYdoc(
    {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'image', attrs: { src: `${MEDIA_ROUTE}/${png.fileAddress}` } }]
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'notes.pdf',
              marks: [
                {
                  type: 'hyperlink',
                  attrs: { href: `${MEDIA_ROUTE}/${pdf.fileAddress}`, target: '_blank' }
                }
              ]
            }
          ]
        }
      ]
    },
    'default',
    migrationExtensions
  )

  await prisma.documents.create({
    data: {
      documentId,
      version: 1,
      commitMessage: '',
      data: Buffer.from(Y.encodeStateAsUpdate(ydoc))
    }
  })

  return {
    documentId,
    fileNames: await listObjects(documentId),
    referenced: [nameOf(png.fileAddress), nameOf(pdf.fileAddress)].sort(),
    unreferenced: nameOf(orphan.fileAddress)
  }
}

const purge = (documentId: string) =>
  softDeleteDocument(prisma, documentId, OWNER).then(() =>
    permanentlyDeleteDocument(prisma, documentId, OWNER)
  )

const cleanup = async () => {
  await prisma.documentMetadata.deleteMany({ where: { ownerId: OWNER } })
  for (const documentId of documentIds) {
    await rm(`${MEDIA_ROOT}/${documentId}`, { recursive: true, force: true })
  }
}

console.log('E2E: a duplicate re-hosts its media (real Postgres + Supabase + storage)')
await cleanup()

try {
  console.log('\n[1] a duplicate owns its own objects')
  const source = await seed('source')
  check(
    source.fileNames.length === 3,
    `the source stored 3 objects (got ${source.fileNames.length})`
  )

  const copy = await duplicateDocument(prisma, source.documentId, OWNER)
  check(copy.status === 'ok', `the duplicate succeeded (got ${copy.status})`)
  if (copy.status !== 'ok') throw new Error('duplicate failed; the rest cannot be asserted')
  const copyId = copy.document.documentId
  documentIds.push(copyId)

  const copyObjects = await listObjects(copyId)
  check(
    copyObjects.join(',') === source.referenced.join(','),
    "the copy's prefix holds exactly the objects its snapshot names"
  )
  check(
    !copyObjects.includes(source.unreferenced),
    'an object no node references was not resurrected under the copy'
  )
  const sizes = await Promise.all(
    copyObjects.map(async (fileName) => [
      Bun.file(`${MEDIA_ROOT}/${copyId}/${fileName}`).size,
      Bun.file(`${MEDIA_ROOT}/${source.documentId}/${fileName}`).size
    ])
  )
  check(
    sizes.length > 0 && sizes.every(([copied, original]) => copied > 0 && copied === original),
    "the copy's objects carry the source's bytes, not empty files"
  )

  const copyUrls = await readStoredUrls(copyId)
  const copyPrefix = `/hypermultimedia/${copyId}/`
  const sourcePrefix = `/hypermultimedia/${source.documentId}/`
  check(
    copyUrls?.nodeAttrs.length === 1 && copyUrls.nodeAttrs[0].includes(copyPrefix),
    "the copy's image `src` names the copy's prefix"
  )
  check(
    copyUrls?.markAttrs.length === 1 && copyUrls.markAttrs[0].includes(copyPrefix),
    "the copy's hyperlink `href` names the copy's prefix"
  )
  check(
    !!copyUrls &&
      ![...copyUrls.nodeAttrs, ...copyUrls.markAttrs].some((url) => url.includes(sourcePrefix)),
    "no stored URL in the copy still names the source's prefix"
  )

  const sourceUrls = await readStoredUrls(source.documentId)
  check(
    !!sourceUrls &&
      [...sourceUrls.nodeAttrs, ...sourceUrls.markAttrs].every((url) => url.includes(sourcePrefix)),
    'the source snapshot was left untouched'
  )

  console.log('\n[2] purging the source erases only the source')
  const sourcePurge = await purge(source.documentId)
  check(sourcePurge.status === 'ok', `the source purge succeeded (got ${sourcePurge.status})`)
  check((await listObjects(source.documentId)).length === 0, "the source's own objects are gone")
  check(
    (await listObjects(copyId)).join(',') === source.referenced.join(','),
    "the copy's objects survived the source purge"
  )
  const copyUrlsAfter = await readStoredUrls(copyId)
  check(
    !!copyUrlsAfter &&
      [...copyUrlsAfter.nodeAttrs, ...copyUrlsAfter.markAttrs].length === 2 &&
      [...copyUrlsAfter.nodeAttrs, ...copyUrlsAfter.markAttrs].every((url) =>
        url.includes(copyPrefix)
      ),
    'the copy still renders — both media URLs resolve under its own prefix'
  )

  console.log('\n[3] a source that was never duplicated')
  const lone = await seed('lone')
  check(lone.fileNames.length === 3, 'the control objects were stored')

  const lonePurge = await purge(lone.documentId)
  check(lonePurge.status === 'ok', `the control purge succeeded (got ${lonePurge.status})`)
  check(
    (await listObjects(lone.documentId)).length === 0,
    "an un-duplicated document's media is still deleted"
  )

  console.log('\n[4] a source with no media')
  const bare = `e2e-dup-${Date.now()}-bare`
  await createMetadata(bare)
  const bareCopy = await duplicateDocument(prisma, bare, OWNER)
  check(bareCopy.status === 'ok', `the media-less duplicate succeeded (got ${bareCopy.status})`)
  if (bareCopy.status === 'ok') {
    documentIds.push(bareCopy.document.documentId)
    check(
      (await listObjects(bareCopy.document.documentId)).length === 0,
      'no storage prefix was created for a media-less copy'
    )
  }
} catch (error) {
  console.error('\nE2E aborted:', error)
  failed += 1
} finally {
  await cleanup()
  await prisma.$disconnect()
}

console.log(`\n${passed} passed, ${failed} failed`)
console.log(failed > 0 ? '\nduplicate-media E2E: FAILED' : '\nduplicate-media E2E: PASSED')
process.exit(failed > 0 ? 1 : 0)
