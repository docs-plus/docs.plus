import { uploadMedia } from '../../../api/services/media.service'

export interface ImageUploadDeps {
  documentId: string
  /** `PUBLIC_RESTAPI_URL` — origin only, since `MEDIA_ROUTE` is appended to it. */
  publicBaseUrl: string | null
}

const MEDIA_ROUTE = '/api/plugins/hypermultimedia'

/**
 * Rehosts a Word image through the pad's own media route, so an imported
 * document carries URLs the editor can parse instead of `data:` payloads.
 */
export const createImageUpload =
  ({ documentId, publicBaseUrl }: ImageUploadDeps) =>
  async (data: Buffer, contentType: string): Promise<string> => {
    // Refusing before the upload matters: a stored object whose URL nobody can
    // build is an orphan, and every retried import would leave another.
    if (!publicBaseUrl) throw new Error('this server has no public media URL configured')

    const file = new File([data], 'image', { type: contentType })
    const { fileAddress } = await uploadMedia(documentId, file)
    return `${publicBaseUrl.replace(/\/+$/, '')}${MEDIA_ROUTE}/${fileAddress}`
  }
