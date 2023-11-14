import mime from 'mime'
import { v4 as uuidv4 } from 'uuid'
import { extractFileType } from './fileType.mjs'
import path from 'path'

const PLUGIN_NAME = 'hypermultimedia'

export const upload = async (documentId, file) => {
  try {
    const format = mime.getExtension(file.mimetype)

    const path = `./temp/${PLUGIN_NAME}/${documentId}/${uuidv4()}.${format}`
    const fileType = extractFileType(format)
    // save file
    await file.mv(path)
    const result = {
      type: 'localStorage',
      error: false,
      fileAddress: `${documentId}/${path.split('/').pop()}`,
      fileType
    }
    return result
  } catch (error) {
    console.error(`[hypermultimedia]: localUploadMedia`, error)
  }
}

export const get = async (documentId, mediaId, res) => {
  try {
    res.set({
      'Content-Type': mime.getType(mediaId),
      'Content-Disposition': `inline; filename="${mediaId}"`,
      'Accept-Ranges': 'bytes'
    })

    // Remove unnecessary or insecure headers, we handel this in nginx and nodejs server
    res.removeHeader('Cross-Origin-Opener-Policy')
    res.removeHeader('Cross-Origin-Resource-Policy')

    return res.sendFile(
      path.join(
        path.join(process.cwd(), `${process.env.LOCAL_STORAGE_PATH}/${documentId}/${mediaId}`)
      )
    )
  } catch (error) {
    console.error(`[hypermultimedia]: localGetMedia`, error)
  }
}
