import { isIOSDevice } from '@utils/platform'
import { canShareFiles, isAbortError } from '@utils/shareFiles'
import { supabaseClient } from '@utils/supabase'
import slugify from 'slugify'

import { conversionErrorMessage, NETWORK_ERROR_MESSAGE } from './conversionErrors'
import type { ExportFormat } from './types'

/** Bare types: the picker rejects a MIME type with parameters such as `charset`. */
const EXPORT_TYPES: Record<ExportFormat, { description: string; mime: string }> = {
  docx: {
    description: 'Word document',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  md: { description: 'Markdown', mime: 'text/markdown' },
  odt: { description: 'OpenDocument text', mime: 'application/vnd.oasis.opendocument.text' }
}

/** Same strict rule as the server's header, so the picker can suggest a name before the fetch. */
const exportFilename = (title: string, format: ExportFormat): string =>
  `${slugify(title, { lower: true, strict: true }) || 'document'}.${format}`

/** The server slugifies before it writes the header, so the quoted form is the only one we can meet. */
const filenameFrom = (disposition: string | null): string | null =>
  disposition?.match(/filename="([^"]+)"/)?.[1] ?? null

const download = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Safari reads the blob after the click returns, so the URL cannot be revoked synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const writeToHandle = async (handle: FileSystemFileHandle, blob: Blob): Promise<boolean> => {
  let writable: FileSystemWritableFileStream | null = null
  try {
    writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return true
  } catch {
    await writable?.abort().catch(() => undefined)
    return false
  }
}

/** `handle` is set only when the person chose a place in the Chromium save picker. */
export interface ExportTarget {
  filename: string
  handle?: FileSystemFileHandle
}

export type ExportResult = 'saved' | 'shared' | 'cancelled'

/**
 * Call it synchronously in the click: the picker needs the click's user activation.
 * Resolves `null` on a cancel. With no picker, or on any other picker error, it
 * resolves a download target.
 */
export const pickExportTarget = async (
  format: ExportFormat,
  title: string
): Promise<ExportTarget | null> => {
  const filename = exportFilename(title, format)
  if (typeof window.showSaveFilePicker !== 'function') return { filename }
  const { description, mime } = EXPORT_TYPES[format]
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description, accept: { [mime]: [`.${format}`] } }]
    })
    return { filename: handle.name, handle }
  } catch (error) {
    return isAbortError(error) ? null : { filename }
  }
}

/**
 * Exports the document in `format` to `target`. Renders from the last saved snapshot,
 * not the live editor. Rejects with a message written for the person who clicked.
 */
export const exportDocument = async (
  documentId: string,
  format: ExportFormat,
  target: ExportTarget
): Promise<ExportResult> => {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession()

  let response: Response
  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}/export?format=${format}`,
      { headers: session?.access_token ? { token: session.access_token } : {} }
    )
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE)
  }

  if (!response.ok) throw new Error(conversionErrorMessage(response.status))

  const blob = await response.blob()
  if (target.handle && (await writeToHandle(target.handle, blob))) return 'saved'

  const filename = target.handle
    ? target.filename
    : filenameFrom(response.headers.get('Content-Disposition')) || target.filename

  // Only iOS: Mac Safari and Android Chrome can share files too, but they keep the download.
  if (!target.handle && isIOSDevice()) {
    const file = new File([blob], filename, { type: EXPORT_TYPES[format].mime })
    if (canShareFiles([file])) {
      try {
        await navigator.share({ files: [file] })
        return 'shared'
      } catch (error) {
        // A slow fetch can spend the gesture, so `NotAllowedError` falls through to download.
        if (isAbortError(error)) return 'cancelled'
      }
    }
  }

  download(blob, filename)
  return 'saved'
}
