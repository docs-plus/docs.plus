/** Bucket allowlist in `packages/supabase/scripts/12-buckets.sql` (`user_avatars`). */
const BUCKET_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'])

const EDGE_STEPS_PX = [512, 320, 192] as const

const FILE_NAME_FOR_TYPE: Record<'image/png' | 'image/jpeg' | 'image/webp', string> = {
  'image/png': 'avatar.png',
  'image/jpeg': 'avatar.jpg',
  'image/webp': 'avatar.webp'
}

const canvasToFile = (
  canvas: HTMLCanvasElement,
  type: 'image/png' | 'image/jpeg' | 'image/webp',
  quality?: number
): Promise<File | null> =>
  new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null)
          return
        }
        resolve(new File([blob], FILE_NAME_FOR_TYPE[type], { type, lastModified: Date.now() }))
      },
      type,
      quality
    )
  })

/**
 * Storage rejects AVIF (and anything outside the bucket allowlist). Decode via
 * canvas when needed and emit a bucket-safe file (upload path stays avatar.png).
 */
export async function prepareAvatarFile(file: File, maxBytes: number): Promise<File> {
  if (file.type === 'image/svg+xml') {
    if (file.size > maxBytes) {
      throw new Error(`Avatar must be less than ${Math.round(maxBytes / 1024)}KB`)
    }
    return file
  }

  if (BUCKET_MIME.has(file.type) && file.size <= maxBytes) {
    return file
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This image format is not supported. Try a JPEG, PNG, WebP, or AVIF.')
  }

  try {
    for (const edge of EDGE_STEPS_PX) {
      const maxDim = Math.max(bitmap.width, bitmap.height)
      const scale = maxDim > edge ? edge / maxDim : 1
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not process image')

      ctx.drawImage(bitmap, 0, 0, width, height)

      const png = await canvasToFile(canvas, 'image/png')
      if (png && png.size <= maxBytes) return png

      for (const quality of [0.85, 0.72, 0.58]) {
        const webp = await canvasToFile(canvas, 'image/webp', quality)
        if (webp && webp.size <= maxBytes) return webp

        const jpeg = await canvasToFile(canvas, 'image/jpeg', quality)
        if (jpeg && jpeg.size <= maxBytes) return jpeg
      }
    }
  } finally {
    bitmap.close()
  }

  throw new Error(`Avatar must be less than ${Math.round(maxBytes / 1024)}KB`)
}
