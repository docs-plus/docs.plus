import { ConversionError, importDocument, type ImportedDocument } from '@api'
import { applyImportedContent } from '@components/TipTap/toolbar/desktop/applyImportedContent'
import * as toast from '@components/toast'
import { isDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { authStore, useStore } from '@stores'
import type { Session } from '@supabase/supabase-js'
import type { Editor } from '@tiptap/core'
import { fetchDocument } from '@utils/fetchDocument'
import { randomDocumentSlug } from '@utils/sanitizeDocumentSlug'
import { supabaseClient } from '@utils/supabase'
import Router from 'next/router'

// Copies SHARE_CACHE and SHARE_KEY in public/service-worker.js.
const SHARE_CACHE = 'docsplus-share-target'
const SHARE_KEY = '/__docsplus/shared-file'
// Holds the stash this tab already started, so a reload cannot import twice.
// It also keeps the created pad, so a retry reuses it instead of making another.
const CLAIM_KEY = 'docsplus:receive-claim'
// Copies MAX_IMPORT_BYTES in the backend document-conversion module.
const MAX_SHARED_BYTES = 10 * 1024 * 1024
const APPLY_TIMEOUT_MS = 60_000
const IMPORTABLE_NAME = /\.(docx|md|markdown|txt)$/i
const IMPORTABLE_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/x-markdown',
  'text/plain'
])
/** Names the file kinds that IMPORTABLE_NAME and IMPORTABLE_TYPES accept. */
export const IMPORTABLE_KINDS = 'Word (.docx), Markdown (.md, .markdown) or plain text (.txt)'

interface SharedFile {
  id: string
  file: File
}

interface OwnedPad {
  slug: string
  documentId: string
  ownerId: string
}

interface ReceivedPad extends OwnedPad {
  imported: ImportedDocument
}

interface Claim {
  id: string
  pad?: OwnedPad
}

/** How one run ends. `opened` means the pad route is already open. */
export type ReceiveOutcome =
  | { kind: 'empty' }
  | { kind: 'signed-out'; filename: string }
  | { kind: 'claimed' }
  | { kind: 'failed'; message: string; canRetry: boolean }
  | { kind: 'opened' }

const readSharedFile = async (): Promise<SharedFile | null> => {
  if (typeof caches === 'undefined') return null
  try {
    const response = await caches.match(SHARE_KEY, { cacheName: SHARE_CACHE })
    if (!response) return null
    const blob = await response.blob()
    const name = decodeURIComponent(response.headers.get('X-Share-Name') || 'Shared file')
    return {
      id: response.headers.get('X-Share-Id') || name,
      file: new File([blob], name, { type: blob.type })
    }
  } catch {
    return null
  }
}

const clearSharedFile = async (): Promise<void> => {
  if (typeof caches === 'undefined') return
  try {
    await caches.delete(SHARE_CACHE)
  } catch {
    // A stash that cannot be deleted is replaced by the next share.
  }
}

const isImportableFile = (file: File): boolean =>
  IMPORTABLE_NAME.test(file.name) || IMPORTABLE_TYPES.has(file.type)

const readClaim = (): Claim | null => {
  try {
    const raw = sessionStorage.getItem(CLAIM_KEY)
    return raw ? (JSON.parse(raw) as Claim) : null
  } catch {
    return null
  }
}

const writeClaim = (claim: Claim | null) => {
  try {
    if (claim) sessionStorage.setItem(CLAIM_KEY, JSON.stringify(claim))
    else sessionStorage.removeItem(CLAIM_KEY)
  } catch {
    // Without storage a reload can start the import again; the stash is gone by then.
  }
}

/** Drops only a claim with no pad, which the Claimed view asks the person to confirm. */
export const dropStalledClaim = (): void => {
  if (!readClaim()?.pad) writeClaim(null)
}

/**
 * Creates an empty pad the sharer owns. The caller keeps it, so a retry converts
 * into the same pad instead of adding a new empty one each time.
 */
const createOwnedPad = async (file: File, session: Session): Promise<OwnedPad> => {
  const draft = await fetchDocument(randomDocumentSlug(), session)
  if (!draft) throw new Error('docs.plus could not create the document. Try again.')

  const title = file.name.replace(/\.[^.]+$/, '').trim() || 'Shared file'
  const headers = { 'Content-Type': 'application/json', token: session.access_token }

  let response: Response
  try {
    response = await fetch(`${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${draft.documentId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ slug: draft.slug, title })
    })
  } catch {
    throw new Error('docs.plus could not be reached. Check your connection and try again.')
  }
  const json = response.ok ? await response.json().catch(() => null) : null
  // Stop unless the sharer owns the row, so the file never lands in another person's pad.
  if (!json?.success || json.data?.ownerId !== session.user.id) {
    throw new Error('docs.plus could not create the document. Try again.')
  }
  return { slug: json.data.slug, documentId: draft.documentId, ownerId: session.user.id }
}

const applyToPad = async (editor: Editor, pad: ReceivedPad, filename: string) => {
  const { hocuspocusProvider } = useStore.getState().settings
  if (editor.isDestroyed || !hocuspocusProvider) return
  const meta = hocuspocusProvider.configuration.document.getMap('metadata')
  // Claim the first-open seed, so the template never lands on top of the file.
  meta.set('needsInitialization', false)
  try {
    await applyImportedContent(editor, pad.imported.content)
  } catch {
    toast.Error(`The editor couldn’t accept ${filename}. The new document is empty.`)
    return
  }
  // The server drops every save while isDraft is set.
  if (meta.get('isDraft')) meta.set('isDraft', false)
  if (pad.imported.warnings.length) {
    toast.Warning(`Imported ${filename}. Some things didn’t survive the conversion.`)
  } else {
    toast.Success(`Imported ${filename}`)
  }
}

/**
 * Waits in the global store for the new pad's editor to sync, then applies the file.
 * It lives outside the pad shell, so it survives the client-side route change only.
 */
const applyWhenPadOpens = (pad: ReceivedPad, filename: string): void => {
  let settled = false

  const tryApply = () => {
    if (settled) return
    const { settings } = useStore.getState()
    const editor = settings.editor.instance as Editor | undefined
    if (settings.metadata?.documentId !== pad.documentId) return
    if (settings.hocuspocusProvider?.configuration.name !== pad.documentId) return
    if (!editor || editor.isDestroyed || settings.editor.providerSyncing) return

    settled = true
    unsubscribe()
    clearTimeout(timer)
    if (isDocumentEditingLocked()) {
      toast.Error(`This document is read-only, so ${filename} was not imported.`)
      return
    }
    // Out of the store callback, so the editor dispatch never runs inside a React commit.
    setTimeout(() => void applyToPad(editor, pad, filename), 0)
  }

  const unsubscribe = useStore.subscribe(tryApply)
  const timer = setTimeout(() => {
    if (settled) return
    settled = true
    unsubscribe()
    toast.Error(`The document took too long to open, so ${filename} was not imported.`)
  }, APPLY_TIMEOUT_MS)
  tryApply()
}

/**
 * Takes the stashed share into a new pad the sharer owns, then opens that pad.
 * `onWorking` fires once the file passed every check and the network work starts.
 */
export const runSharedImport = async (
  onWorking: (filename: string) => void
): Promise<ReceiveOutcome> => {
  const shared = await readSharedFile()
  if (!shared) return { kind: 'empty' }
  const { file } = shared
  if (!authStore.getState().session) return { kind: 'signed-out', filename: file.name }
  if (file.size > MAX_SHARED_BYTES || !isImportableFile(file)) {
    await clearSharedFile()
    return {
      kind: 'failed',
      message:
        file.size > MAX_SHARED_BYTES
          ? `This file is larger than ${MAX_SHARED_BYTES / 1024 / 1024} MB, so it can’t be imported.`
          : `docs.plus can import ${IMPORTABLE_KINDS} files only.`,
      canRetry: false
    }
  }
  const claim = readClaim()
  // A claim without a pad means a run stopped mid-create; its pad may exist.
  if (claim?.id === shared.id && !claim.pad) return { kind: 'claimed' }

  const {
    data: { session }
  } = await supabaseClient.auth.getSession()
  if (!session) {
    return {
      kind: 'failed',
      message: 'Your sign-in has ended. Sign in again, then try again.',
      canRetry: true
    }
  }
  // Reuse the kept pad only for the same account, so the file never lands in another person's pad.
  let ownedPad =
    claim?.id === shared.id && claim.pad?.ownerId === session.user.id ? claim.pad : undefined
  writeClaim({ id: shared.id, pad: ownedPad })
  onWorking(file.name)
  try {
    if (!ownedPad) {
      ownedPad = await createOwnedPad(file, session)
      writeClaim({ id: shared.id, pad: ownedPad })
    }
    // The import route answers 404 until the PUT made the row.
    const pad: ReceivedPad = {
      ...ownedPad,
      imported: await importDocument(ownedPad.documentId, file)
    }
    await clearSharedFile()
    writeClaim(null)
    applyWhenPadOpens(pad, file.name)
    // Client-side, so the store listener above survives the route change.
    await Router.replace(`/${pad.slug}`)
    return { kind: 'opened' }
  } catch (error) {
    const status = error instanceof ConversionError ? error.status : null
    // 413, 415 and 422 mean the file itself is bad, so a retry fails the same way.
    const rejected = status === 413 || status === 415 || status === 422
    // 403 and 404 mean the kept pad is gone, so a retry must create a new one.
    const padLost = status === 403 || status === 404
    if (rejected) await clearSharedFile()
    // Keep a created pad in the claim, so Try again converts into it.
    if (rejected || padLost || !ownedPad) writeClaim(null)
    return {
      kind: 'failed',
      message: error instanceof Error ? error.message : 'The import failed. Try again.',
      canRetry: !rejected
    }
  }
}
