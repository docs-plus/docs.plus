import * as toast from '@components/toast'
import { fitDimensionsToBounds, getEditorContentWidth } from '@docs.plus/extension-hypermultimedia'
import type { Editor } from '@tiptap/core'
import { supabaseClient } from '@utils/supabase'

import {
  addUploadPlaceholder,
  findUploadPlaceholderPos,
  removeUploadPlaceholder
} from '../nodes/MediaUploadPlaceholder'
import { MEDIA_MAX_UPLOAD_BYTES, mediaUploadLimitExceededMessage } from './mediaUploadLimits'

export interface ImageDimensions {
  width: number
  height: number
  aspectRatio: number
  originalWidth?: number
  originalHeight?: number
}

export interface DocumentMetadata {
  documentId: string
}

interface UploadPlaceholderAttributes {
  src: string
  width?: number
  height?: number
}

const FILE_TYPE_MAP = {
  image: 'image',
  video: 'video',
  audio: 'audio'
} as const

interface UploadedMediaResponse {
  fileAddress: string
  fileType: keyof typeof FILE_TYPE_MAP
}

const DEFAULT_DIMENSIONS = {
  maxWidth: 800,
  maxHeight: 600,
  minWidth: 200,
  minHeight: 150
} as const

const generateUploadId = (): string =>
  `upload_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

interface UploadErrorBody {
  error?: { message?: string }
}

const parseUploadErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as UploadErrorBody
    if (data.error?.message) return data.error.message
  } catch {
    // Non-JSON body (proxy errors, etc.)
  }

  if (response.status === 413) return mediaUploadLimitExceededMessage()

  return 'Upload failed'
}

const getFileType = (file: File): keyof typeof FILE_TYPE_MAP => {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'image'
}

export const calculateAdaptiveDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number = DEFAULT_DIMENSIONS.maxWidth,
  maxHeight: number = DEFAULT_DIMENSIONS.maxHeight
): ImageDimensions => {
  if (!originalWidth || !originalHeight) {
    return { width: 400, height: 300, aspectRatio: 4 / 3 }
  }

  const { minWidth, minHeight } = DEFAULT_DIMENSIONS
  const fitted = fitDimensionsToBounds(originalWidth, originalHeight, { maxWidth, maxHeight })
  let targetWidth = fitted.width
  let targetHeight = fitted.height
  const aspectRatio = originalWidth / originalHeight

  if (targetWidth < minWidth && targetHeight < minHeight) {
    if (aspectRatio >= 1) {
      targetWidth = minWidth
      targetHeight = Math.round(minWidth / aspectRatio)
    } else {
      targetHeight = minHeight
      targetWidth = Math.round(minHeight * aspectRatio)
    }
  }

  return {
    width: Math.round(targetWidth),
    height: Math.round(targetHeight),
    aspectRatio: Math.round(aspectRatio * 100) / 100,
    originalWidth,
    originalHeight
  }
}

const getImageDimensions = async (
  file: File,
  editor: Editor | null
): Promise<ImageDimensions & { localUrl: string }> => {
  const localUrl = URL.createObjectURL(file)
  const contentWidth = editor ? getEditorContentWidth(editor) : 0
  const maxWidth = contentWidth > 0 ? contentWidth : DEFAULT_DIMENSIONS.maxWidth

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const dimensions = calculateAdaptiveDimensions(img.width, img.height, maxWidth)
      resolve({ ...dimensions, localUrl })
    }
    img.onerror = () =>
      resolve({
        width: 400,
        height: 300,
        aspectRatio: 4 / 3,
        localUrl
      })
    img.src = localUrl
  })
}

export const uploadMediaFile = async (
  editor: Editor | null,
  file: File,
  docMetadata: DocumentMetadata
): Promise<void> => {
  if (!editor) return

  if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
    toast.Error(mediaUploadLimitExceededMessage())
    return
  }

  const uploadId = generateUploadId()
  const fileType = getFileType(file)

  let imageData: Partial<ImageDimensions & { localUrl: string }> = {}
  if (fileType === 'image') {
    imageData = await getImageDimensions(file, editor)
  }

  const abortController = new AbortController()

  // The placeholder dispatch lives inside try so a plugin-apply throw surfaces
  // the toast and runs the catch cleanup instead of an unhandled rejection.
  try {
    addUploadPlaceholder(editor, {
      uploadId,
      fileName: file.name,
      fileType,
      localUrl: imageData.localUrl,
      width: imageData.width,
      height: imageData.height,
      onCancel: () => abortController.abort()
    })

    const formData = new FormData()
    formData.append('mediaFile', file, file.name)

    // Upload is an authenticated write; send the Supabase token via the `token`
    // header the REST API reads (same convention as fetchDocument).
    const {
      data: { session }
    } = await supabaseClient.auth.getSession()
    const headers: Record<string, string> = {}
    if (session?.access_token) headers.token = session.access_token

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_RESTAPI_URL}/plugins/hypermultimedia/${docMetadata.documentId}`,
      {
        method: 'POST',
        body: formData,
        headers,
        signal: abortController.signal
      }
    )

    if (!response.ok) throw new Error(await parseUploadErrorMessage(response))

    const result = (await response.json()) as UploadedMediaResponse
    const mediaURL = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/plugins/hypermultimedia/${result.fileAddress}`

    if (!result.fileType) {
      throw new Error('File type is not recognized.')
    }

    if (editor.isDestroyed) return

    const mediaType = FILE_TYPE_MAP[result.fileType as keyof typeof FILE_TYPE_MAP] || 'image'
    const nodeAttrs: UploadPlaceholderAttributes = { src: mediaURL }

    if (mediaType === 'image' && typeof imageData.width === 'number') {
      nodeAttrs.width = imageData.width
    }
    if (mediaType === 'image' && typeof imageData.height === 'number') {
      nodeAttrs.height = imageData.height
    }

    const placeholderPos = findUploadPlaceholderPos(editor.state, uploadId)
    if (placeholderPos === null) {
      console.warn('Upload placeholder context was deleted; inserting media at the selection')
    }
    editor.commands.insertContentAt(placeholderPos ?? editor.state.selection.from, {
      type: mediaType,
      attrs: nodeAttrs
    })
    removeUploadPlaceholder(editor, uploadId)

    toast.Success('Upload successful!')
  } catch (error) {
    if (!editor.isDestroyed) removeUploadPlaceholder(editor, uploadId)
    if (abortController.signal.aborted) return

    console.error('Upload error:', error)
    toast.Error(error instanceof Error ? error.message : 'Error uploading file')
  } finally {
    if (imageData.localUrl) URL.revokeObjectURL(imageData.localUrl)
  }
}
