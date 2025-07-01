import { Popover, PopoverTrigger, PopoverContent } from '@components/ui/Popover'
import React, { useState, useCallback, useEffect } from 'react'
import { HiOutlinePhoto, HiOutlineFilm, HiOutlineMusicalNote } from 'react-icons/hi2'
import { FaYoutube, FaVimeo, FaSoundcloud, FaXTwitter } from 'react-icons/fa6'
import { ImageBox, Film } from '@icons'
import ToolbarButton from './ToolbarButton'
import toast from 'react-hot-toast'
import { useStore } from '@stores'
import { MdCloudUpload } from 'react-icons/md'
import { MdOutlineImage } from 'react-icons/md'
import { MdLocalMovies, MdAudiotrack } from 'react-icons/md'
import { FaRegFileImage, FaRegFileVideo, FaRegFileAudio } from 'react-icons/fa6'
import { FiFilm } from 'react-icons/fi'

// Constants
const MEDIA_TYPES = ['Picture', 'Video', 'Audio', 'Youtube', 'Vimeo', 'SoundCloud', 'x.com']

const MEDIA_REGEX = {
  Youtube: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/g,
  Vimeo: /(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com)\/?(.+)/g,
  SoundCloud: /(?:https?:\/\/)?(?:www\.)?(?:soundcloud\.com)\/?(.+)/g,
  'x.com': /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/?(.+)/g,
  Audio:
    /^(?:(?:https?|ftp):\/\/(?:www\.)?[^\/]+\/|\/|\.\.?\/)?[\w\-\/\\]+.(mp3|wav|aac|flac|ogg|m4a|aiff|ape|asf|m4p|m4b|mp2|mpc|wma|webm|opus|ra|rm|wavpack|wv)$/i,
  Video:
    /^(?:(?:https?|ftp):\/\/(?:www\.)?[^\/]+\/|\/|\.\.?\/)?[\w\-\/\\]+.(mp4|avi|mov|wmv|flv|mkv|3gp|3g2|asf|divx|m4v|mpg|m2v|m4p|mts|m2ts|ogv|rm|rmvb|ts|vob|webm|qt|f4v)$/i,
  Picture:
    /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?$/i
}

const MEDIA_ICONS = {
  Picture: MdOutlineImage,
  Youtube: FaYoutube,
  Vimeo: FaVimeo,
  SoundCloud: FaSoundcloud,
  'x.com': FaXTwitter,
  Video: FiFilm,
  Audio: MdAudiotrack
}

const MEDIA_COMMANDS = {
  Youtube: 'setYoutubeVideo',
  Vimeo: 'setVimeo',
  SoundCloud: 'setSoundCloud',
  'x.com': 'setTwitter',
  Video: 'setVideo',
  Audio: 'setAudio',
  Picture: 'setImage'
}

const FILE_TYPE_MAP = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio'
}

const DEFAULT_DIMENSIONS = {
  maxWidth: 800,
  maxHeight: 600,
  minWidth: 200,
  minHeight: 150
}

// Utility Functions
const calculateAdaptiveDimensions = (originalWidth, originalHeight) => {
  if (!originalWidth || !originalHeight) {
    return { width: null, height: null, aspectRatio: null }
  }

  const { maxWidth, maxHeight, minWidth, minHeight } = DEFAULT_DIMENSIONS
  const aspectRatio = originalWidth / originalHeight
  let targetWidth = originalWidth
  let targetHeight = originalHeight

  // Scale down if too large
  if (originalWidth > maxWidth) {
    targetWidth = maxWidth
    targetHeight = Math.round(maxWidth / aspectRatio)
  }

  if (targetHeight > maxHeight) {
    targetHeight = maxHeight
    targetWidth = Math.round(maxHeight * aspectRatio)
  }

  // Scale up if too small
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
    aspectRatio: Math.round(aspectRatio * 100) / 100
  }
}

const getFileType = (file) => {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'image'
}

const getImageDimensions = async (file, fileType) => {
  if (fileType !== 'image') {
    return { localUrl: null, width: null, height: null, aspectRatio: null }
  }

  const localUrl = URL.createObjectURL(file)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const adaptiveDimensions = calculateAdaptiveDimensions(img.width, img.height)
      resolve({
        localUrl,
        ...adaptiveDimensions,
        originalWidth: img.width,
        originalHeight: img.height
      })
    }
    img.onerror = () => resolve({ localUrl, width: null, height: null, aspectRatio: null })
    img.src = localUrl
  })
}

const detectMediaType = (url) => {
  for (const [type, regex] of Object.entries(MEDIA_REGEX)) {
    if (regex.test(url)) return type
  }
  return 'Picture'
}

const generateUploadId = () => `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// Upload Management
class UploadManager {
  constructor(editor, uploadId) {
    this.editor = editor
    this.uploadId = uploadId
    this.xhr = null
  }

  findPlaceholder() {
    const { state } = this.editor
    let placeholderPos = null
    let placeholderNode = null

    state.doc.descendants((node, pos) => {
      if (node.type.name === 'mediaUploadPlaceholder' && node.attrs.uploadId === this.uploadId) {
        placeholderPos = pos
        placeholderNode = node
        return false
      }
    })

    return { placeholderPos, placeholderNode }
  }

  updateProgress(progress) {
    const { placeholderPos } = this.findPlaceholder()
    if (placeholderPos !== null) {
      this.editor.commands.updateAttributes('mediaUploadPlaceholder', { progress })
    }
  }

  replacePlaceholder(mediaType, url) {
    const { placeholderPos, placeholderNode } = this.findPlaceholder()
    if (placeholderPos === null) return

    const { state } = this.editor
    const tr = state.tr
    const nodeAttrs = { src: url }

    // Add dimensions for images
    if (mediaType === 'Image' && placeholderNode) {
      if (placeholderNode.attrs.width) nodeAttrs.width = placeholderNode.attrs.width
      if (placeholderNode.attrs.height) nodeAttrs.height = placeholderNode.attrs.height
    }

    tr.replaceWith(
      placeholderPos,
      placeholderPos + 1,
      state.schema.nodes[mediaType].create(nodeAttrs)
    )
    this.editor.view.dispatch(tr)
  }

  removePlaceholder() {
    const { placeholderPos } = this.findPlaceholder()
    if (placeholderPos !== null) {
      const tr = this.editor.state.tr
      tr.delete(placeholderPos, placeholderPos + 1)
      this.editor.view.dispatch(tr)
    }
  }

  setupCancelHandler() {
    const cancelHandler = (event) => {
      if (event.detail.uploadId === this.uploadId) {
        this.xhr?.abort()
        window.removeEventListener('cancelUpload', cancelHandler)
        toast.error('Upload cancelled')
      }
    }
    window.addEventListener('cancelUpload', cancelHandler)
    return cancelHandler
  }
}

// File Upload Handler
const handleFileUpload = async (event, docMetadata, editor) => {
  const file = event.target.files[0]
  if (!file) return

  const uploadId = generateUploadId()
  const fileType = getFileType(file)
  const imageData = await getImageDimensions(file, fileType)
  const uploadManager = new UploadManager(editor, uploadId)

  console.log('File upload started:', { file, fileType, imageData })

  // Insert placeholder
  editor.commands.insertContent({
    type: 'mediaUploadPlaceholder',
    attrs: {
      progress: 0,
      fileName: file.name,
      fileType,
      uploadId,
      ...imageData
    }
  })

  const formdata = new FormData()
  formdata.append('mediaFile', file, file.name)

  try {
    const xhr = new XMLHttpRequest()
    uploadManager.xhr = xhr

    const cancelHandler = uploadManager.setupCancelHandler()

    // Progress tracking
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100)
        uploadManager.updateProgress(progress)
      }
    }

    // Success handler
    xhr.onload = () => {
      window.removeEventListener('cancelUpload', cancelHandler)

      if (xhr.status >= 200 && xhr.status < 300) {
        const result = JSON.parse(xhr.responseText)
        const mediaURL = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/plugins/hypermultimedia/${result.fileAddress}`

        if (!result.fileType) {
          toast.error('File type is not recognized.')
          uploadManager.removePlaceholder()
          return
        }

        const mediaType = FILE_TYPE_MAP[result.fileType] || 'Image'
        uploadManager.replacePlaceholder(mediaType, mediaURL)
        toast.success(<b>Upload successful!</b>)
      } else {
        toast.error('Error uploading file')
        uploadManager.removePlaceholder()
      }
    }

    // Error handler
    xhr.onerror = () => {
      window.removeEventListener('cancelUpload', cancelHandler)
      toast.error('Error uploading file')
      uploadManager.removePlaceholder()
    }

    // Start upload
    xhr.open(
      'POST',
      `${process.env.NEXT_PUBLIC_RESTAPI_URL}/plugins/hypermultimedia/${docMetadata.documentId}`
    )
    xhr.send(formdata)
  } catch (error) {
    console.error('Upload error:', error)
    toast.error('Error uploading file')
    uploadManager.removePlaceholder()
  }
}

// Components
const MediaTypeButton = ({ type, isActive, onClick }) => {
  const IconComponent = MEDIA_ICONS[type]
  return (
    <button
      className={`btn btn-sm join-item flex-1 ${isActive ? 'btn-primary' : 'btn-ghost'} tooltip`}
      data-tip={type}
      onClick={onClick}>
      <IconComponent size={18} />
    </button>
  )
}

const UploadDropzone = ({ onFileUpload }) => (
  <>
    <div className="divider m-1 text-sm text-gray-500">OR</div>

    <div className="flex w-full items-center justify-center">
      <label
        htmlFor="dropzone-file"
        className="flex h-36 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <MdCloudUpload size={30} className="mb-2 text-gray-500" />
          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Picture, Video or Audio (MAX. 2MB)
          </p>
        </div>
        <input id="dropzone-file" type="file" className="hidden" onChange={onFileUpload} />
      </label>
    </div>
  </>
)

const MediaForm = ({ onSubmit, editor }) => {
  const { metadata: docMetadata } = useStore((state) => state.settings)
  const [mediaURL, setMediaURL] = useState('')
  const [mediaType, setMediaType] = useState(MEDIA_TYPES[0])
  const inputRef = React.useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [mediaType])

  const handleURLChange = (e) => {
    const url = e.target.value
    if (!url) {
      setMediaURL('')
      return
    }

    setMediaType(detectMediaType(url))
    setMediaURL(url)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(mediaURL, mediaType)
  }

  const IconComponent = MEDIA_ICONS[mediaType]

  return (
    <div className="card bg-base-100 w-96 shadow-xl">
      <div className="card-body p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Media Type Selector */}
          <div className="w-full">
            <h3 className="label-text mb-2 font-medium">Media Type</h3>
            <div className="join bg-base-300 relative z-1 flex rounded-md">
              {MEDIA_TYPES.map((type) => (
                <MediaTypeButton
                  key={type}
                  type={type}
                  isActive={mediaType === type}
                  onClick={() => setMediaType(type)}
                />
              ))}
            </div>
          </div>

          {/* URL Input */}
          <div className="form-control">
            <div className="join w-full">
              <div className="w-full">
                <label className="input validator join-item">
                  <IconComponent size={20} />
                  <input
                    type="url"
                    placeholder={`Enter ${mediaType} URL...`}
                    value={mediaURL}
                    onChange={handleURLChange}
                  />
                </label>
                <div className="validator-hint hidden">Enter valid URL</div>
              </div>
              <button
                className="btn btn-neutral join-item"
                type="submit"
                disabled={!mediaURL.trim()}>
                Insert
              </button>
            </div>
          </div>

          {/* File Upload */}
          <UploadDropzone onFileUpload={(e) => handleFileUpload(e, docMetadata, editor)} />
        </form>
      </div>
    </div>
  )
}

const InsertMultimedia = () => {
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const insertMedia = useCallback(
    async (mediaUrl, mediaType) => {
      if (!mediaUrl) return

      try {
        if (mediaType === 'Picture') {
          // Get dimensions for images
          const img = new Image()
          img.crossOrigin = 'anonymous'

          const imageData = await new Promise((resolve) => {
            img.onload = () => {
              const adaptiveDimensions = calculateAdaptiveDimensions(img.width, img.height)
              resolve(adaptiveDimensions)
            }
            img.onerror = () => resolve({ width: null, height: null })
            img.src = mediaUrl
          })

          editor
            .chain()
            .focus()
            [MEDIA_COMMANDS[mediaType]]({
              src: mediaUrl,
              width: imageData.width,
              height: imageData.height
            })
            .run()
        } else {
          editor.chain().focus()[MEDIA_COMMANDS[mediaType]]({ src: mediaUrl }).run()
        }
      } catch (error) {
        console.error('Media insertion error:', error)
        editor.chain().focus()[MEDIA_COMMANDS[mediaType]]({ src: mediaUrl }).run()
      }
    },
    [editor]
  )

  return (
    <Popover>
      <PopoverTrigger asChild={true}>
        <ToolbarButton tooltip="Insert Media">
          <ImageBox fill="rgba(0,0,0,.7)" size="14" />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="z-50 border-none bg-transparent p-0 shadow-none">
        <MediaForm onSubmit={insertMedia} editor={editor} />
      </PopoverContent>
    </Popover>
  )
}

export default InsertMultimedia
