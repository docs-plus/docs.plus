import { resolveMediaDisplayUrl } from '@components/chatroom/utils/chatMediaUrl'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import type { DocumentMetadata } from '@components/TipTap/mediaPopovers/uploadMediaFile'
import type { Editor } from '@tiptap/core'
import type { MessageMediaItem, TMsgRow } from '@types'
import { TIPTAP_NODES } from '@types'
import { supabaseClient } from '@utils/supabase'

const uploadBlobToDocument = async (
  blob: Blob,
  fileName: string,
  docMetadata: DocumentMetadata
): Promise<string> => {
  const formData = new FormData()
  formData.append('mediaFile', blob, fileName)

  const {
    data: { session }
  } = await supabaseClient.auth.getSession()
  const headers: Record<string, string> = {}
  if (session?.access_token) headers.token = session.access_token

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_RESTAPI_URL}/plugins/hypermultimedia/${docMetadata.documentId}`,
    { method: 'POST', body: formData, headers }
  )

  if (!response.ok) {
    throw new Error('Failed to copy media into document')
  }

  const result = (await response.json()) as { fileAddress: string }
  return `${process.env.NEXT_PUBLIC_RESTAPI_URL}/plugins/hypermultimedia/${result.fileAddress}`
}

const fetchMediaBlob = async (media: MessageMediaItem): Promise<Blob | null> => {
  const url = await resolveMediaDisplayUrl(media)
  if (!url) return null
  const response = await fetch(url)
  if (!response.ok) return null
  return response.blob()
}

const buildFileLinkParagraph = (name: string, href: string) => ({
  type: TIPTAP_NODES.PARAGRAPH_TYPE,
  content: [
    {
      type: TIPTAP_NODES.TEXT_TYPE,
      marks: [
        {
          type: TIPTAP_NODES.HYPERLINK_TYPE,
          attrs: { id: null, href, target: '_blank', class: null }
        }
      ],
      text: name
    }
  ]
})

const buildAssetNode = (mediaType: 'image' | 'video' | 'audio', src: string) => {
  switch (mediaType) {
    case 'image':
      return { type: TIPTAP_NODES.IMAGE_TYPE, attrs: { src } }
    case 'video':
      return { type: 'video', attrs: { src } }
    case 'audio':
      return { type: 'audio', attrs: { src } }
    default: {
      const _never: never = mediaType
      return _never
    }
  }
}

const copyOneMediaToDoc = async (
  media: MessageMediaItem,
  docMetadata: DocumentMetadata
): Promise<Record<string, unknown> | null> => {
  const blob = await fetchMediaBlob(media)
  if (!blob) return null

  const fileName = media.name?.trim() || `${media.type}-attachment`
  const url = await uploadBlobToDocument(blob, fileName, docMetadata)

  if (media.type === 'file') {
    return buildFileLinkParagraph(fileName, url)
  }

  // The chat media's own kind is authoritative. Re-detecting from the re-hosted
  // blob's content-type misclassifies `.webm` voice notes as video (webm's
  // extension maps to video), producing a `video` doc node + comment anchor.
  return buildAssetNode(media.type, url)
}

export const buildCopyToDocContent = async (
  message: TMsgRow,
  docMetadata: DocumentMetadata | null | undefined
): Promise<Record<string, unknown>[]> => {
  const medias = parseMessageMedias(message.medias)
  if (!docMetadata?.documentId || medias.length === 0) return []

  const nodes = await Promise.all(medias.map((media) => copyOneMediaToDoc(media, docMetadata)))

  return nodes.filter((node): node is Record<string, unknown> => node != null)
}

export const insertCopyToDocNodes = (
  editor: Editor,
  insertPosition: number,
  paragraphNode: Record<string, unknown>,
  mediaNodes: Record<string, unknown>[]
) => {
  const content = [paragraphNode, ...mediaNodes]
  editor.chain().focus().insertContentAt(insertPosition, content).scrollIntoView().run()
}
