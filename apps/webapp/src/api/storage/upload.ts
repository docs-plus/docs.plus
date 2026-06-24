import { supabaseClient } from '@utils/supabase'

export type StorageUploadProgress = {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

const supabaseStorageObjectUrl = (bucketName: string, filePath: string): string => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!base) throw new Error('Supabase URL is not configured')

  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
  return `${base}/storage/v1/object/${encodeURIComponent(bucketName)}/${encodedPath}`
}

const parseUploadError = (xhr: XMLHttpRequest): string => {
  const fallback =
    xhr.status === 413
      ? 'File exceeds the upload size limit'
      : xhr.statusText?.trim() || 'Failed to upload file'

  if (!xhr.responseText) return fallback

  try {
    const body = JSON.parse(xhr.responseText) as { message?: string; error?: string }
    return body.message?.trim() || body.error?.trim() || fallback
  } catch {
    return xhr.responseText.trim() || fallback
  }
}

export const uploadFileToStorageWithProgress = async (
  bucketName: string,
  filePath: string,
  file: File,
  contentType?: string,
  { onProgress, signal }: StorageUploadProgress = {}
): Promise<{ data: { path: string } | null; error: Error | null }> => {
  if (!navigator.onLine) {
    return { data: null, error: new Error('Network offline') }
  }

  const {
    data: { session }
  } = await supabaseClient.auth.getSession()

  const accessToken = session?.access_token
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!accessToken || !anonKey) {
    return { data: null, error: new Error('Not authenticated') }
  }

  const url = supabaseStorageObjectUrl(bucketName, filePath)

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    xhr.setRequestHeader('apikey', anonKey)
    xhr.setRequestHeader('x-upsert', 'true')
    if (contentType) {
      xhr.setRequestHeader('Content-Type', contentType)
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100))
      onProgress(percent)
    }

    const finish = (error: Error | null) => {
      signal?.removeEventListener('abort', onAbort)
      resolve(error ? { data: null, error } : { data: { path: filePath }, error: null })
    }

    const onAbort = () => {
      xhr.abort()
      finish(new DOMException('Upload cancelled', 'AbortError'))
    }

    if (signal?.aborted) {
      finish(new DOMException('Upload cancelled', 'AbortError'))
      return
    }

    signal?.addEventListener('abort', onAbort, { once: true })

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        finish(null)
        return
      }
      finish(new Error(parseUploadError(xhr)))
    }

    xhr.onerror = () => finish(new Error('Network error while uploading file'))
    xhr.onabort = () => finish(new DOMException('Upload cancelled', 'AbortError'))

    xhr.send(file)
  })
}

export const uploadFileToStorage = async (
  bucketName: string,
  filePath: string,
  file: File,
  contentType?: string
): Promise<{ data: { path: string } | null; error: Error | null }> => {
  const { data, error } = await uploadFileToStorageWithProgress(
    bucketName,
    filePath,
    file,
    contentType
  )
  return { data, error }
}
