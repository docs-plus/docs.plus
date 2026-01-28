import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '@stores'
import { TIPTAP_NODES } from '@types'
import * as toast from '@components/toast'
import { MdCloudUpload, MdOutlineImage, MdAudiotrack } from 'react-icons/md'
import { FaYoutube, FaVimeo, FaSoundcloud, FaXTwitter } from 'react-icons/fa6'
import { FiFilm } from 'react-icons/fi'
import { usePopoverState } from '@components/ui/Popover'
import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'

// Types and Interfaces
type MediaType = 'Picture' | 'Video' | 'Audio' | 'Youtube' | 'Vimeo' | 'SoundCloud' | 'x.com'

interface MediaConfig {
  icon: React.ComponentType<{ size?: number }>
  command: string
  regex: RegExp
}

interface ImageDimensions {
  width: number
  height: number
  aspectRatio: number
  originalWidth?: number
  originalHeight?: number
}

// Constants
const MEDIA_CONFIG: Record<MediaType, MediaConfig> = {
  Picture: {
    icon: MdOutlineImage,
    command: 'setImage',
    regex:
      /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?$/i
  },
  Video: {
    icon: FiFilm,
    command: 'setVideo',
    regex:
      /^(?:(?:https?|ftp):\/\/(?:www\.)?[^/]+\/|\/|\.\.?\/)?[\w\-/\\]+\.(mp4|avi|mov|wmv|flv|mkv|3gp|3g2|asf|divx|m4v|mpg|m2v|m4p|mts|m2ts|ogv|rm|rmvb|ts|vob|webm|qt|f4v)$/i
  },
  Audio: {
    icon: MdAudiotrack,
    command: 'setAudio',
    regex:
      /^(?:(?:https?|ftp):\/\/(?:www\.)?[^/]+\/|\/|\.\.?\/)?[\w\-/\\]+\.(mp3|wav|aac|flac|ogg|m4a|aiff|ape|asf|m4p|m4b|mp2|mpc|wma|webm|opus|ra|rm|wavpack|wv)$/i
  },
  Youtube: {
    icon: FaYoutube,
    command: 'setYoutubeVideo',
    regex: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/g
  },
  Vimeo: {
    icon: FaVimeo,
    command: 'setVimeo',
    regex: /(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com)\/?(.+)/g
  },
  SoundCloud: {
    icon: FaSoundcloud,
    command: 'setSoundCloud',
    regex: /(?:https?:\/\/)?(?:www\.)?(?:soundcloud\.com)\/?(.+)/g
  },
  'x.com': {
    icon: FaXTwitter,
    command: 'setTwitter',
    regex: /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/?(.+)/g
  }
}

const DEFAULT_DIMENSIONS = {
  maxWidth: 800,
  maxHeight: 600,
  minWidth: 200,
  minHeight: 150
} as const

const FILE_TYPE_MAP = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio'
} as const

// Utility Functions
const generateUploadId = (): string =>
  `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const getFileType = (file: File): keyof typeof FILE_TYPE_MAP => {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'image'
}

const calculateAdaptiveDimensions = (
  originalWidth: number,
  originalHeight: number
): ImageDimensions => {
  if (!originalWidth || !originalHeight) {
    return { width: 400, height: 300, aspectRatio: 4 / 3 }
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
    aspectRatio: Math.round(aspectRatio * 100) / 100,
    originalWidth,
    originalHeight
  }
}

const detectMediaType = (url: string): MediaType => {
  for (const [type, config] of Object.entries(MEDIA_CONFIG)) {
    if (config.regex.test(url)) return type as MediaType
  }
  return 'Picture'
}

const getImageDimensions = async (file: File): Promise<ImageDimensions & { localUrl: string }> => {
  const localUrl = URL.createObjectURL(file)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const dimensions = calculateAdaptiveDimensions(img.width, img.height)
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

// Custom Hooks
const useUploadManager = (editor: any) => {
  const uploadFile = useCallback(
    async (file: File, docMetadata: any) => {
      const uploadId = generateUploadId()
      const fileType = getFileType(file)

      let imageData = {}
      if (fileType === 'image') {
        imageData = await getImageDimensions(file)
      }

      // Insert placeholder
      editor.commands.insertContent({
        type: TIPTAP_NODES.MEDIA_UPLOAD_PLACEHOLDER_TYPE,
        attrs: {
          progress: 0,
          fileName: file.name,
          fileType,
          uploadId,
          ...imageData
        }
      })

      const formData = new FormData()
      formData.append('mediaFile', file, file.name)

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_RESTAPI_URL}/plugins/hypermultimedia/${docMetadata.documentId}`,
          {
            method: 'POST',
            body: formData
          }
        )

        if (!response.ok) throw new Error('Upload failed')

        const result = await response.json()
        const mediaURL = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/plugins/hypermultimedia/${result.fileAddress}`

        if (!result.fileType) {
          throw new Error('File type is not recognized.')
        }

        // Replace placeholder with actual media
        const mediaType = FILE_TYPE_MAP[result.fileType as keyof typeof FILE_TYPE_MAP] || 'Image'
        const { state } = editor
        let placeholderPos: number | null = null

        state.doc.descendants((node: any, pos: number) => {
          if (
            node.type.name === TIPTAP_NODES.MEDIA_UPLOAD_PLACEHOLDER_TYPE &&
            node.attrs.uploadId === uploadId
          ) {
            placeholderPos = pos
            return false
          }
        })

        if (placeholderPos !== null) {
          const tr = state.tr
          const nodeAttrs: any = { src: mediaURL }

          if (mediaType === 'Image' && imageData) {
            if ((imageData as any).width) nodeAttrs.width = (imageData as any).width
            if ((imageData as any).height) nodeAttrs.height = (imageData as any).height
          }

          tr.replaceWith(
            placeholderPos,
            placeholderPos + 1,
            state.schema.nodes[mediaType].create(nodeAttrs)
          )
          editor.view.dispatch(tr)
        }

        toast.Success('Upload successful!')
      } catch (error) {
        console.error('Upload error:', error)
        toast.Error(error instanceof Error ? error.message : 'Error uploading file')

        // Remove placeholder on error
        const { state } = editor
        let placeholderPos: number | null = null

        state.doc.descendants((node: any, pos: number) => {
          if (
            node.type.name === TIPTAP_NODES.MEDIA_UPLOAD_PLACEHOLDER_TYPE &&
            node.attrs.uploadId === uploadId
          ) {
            placeholderPos = pos
            return false
          }
        })

        if (placeholderPos !== null) {
          const tr = state.tr
          tr.delete(placeholderPos, placeholderPos + 1)
          editor.view.dispatch(tr)
        }
      }
    },
    [editor]
  )

  return { uploadFile }
}

// Components
interface MediaTypeButtonProps {
  type: MediaType
  isActive: boolean
  onClick: () => void
}

const MediaTypeButton: React.FC<MediaTypeButtonProps> = ({ type, isActive, onClick }) => {
  const IconComponent = MEDIA_CONFIG[type].icon

  return (
    <Button
      variant={isActive ? 'primary' : 'ghost'}
      size="sm"
      className="join-item tooltip flex-1"
      data-tip={type}
      onClick={onClick}
      startIcon={<IconComponent size={18} />}
    />
  )
}

interface UploadDropzoneProps {
  onFileUpload: (file: File) => void
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({ onFileUpload }) => {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only reset if actually leaving the container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const file = files[0]

    if (
      file &&
      (file.type.startsWith('image/') ||
        file.type.startsWith('video/') ||
        file.type.startsWith('audio/'))
    ) {
      onFileUpload(file)
    } else {
      toast.Error('Please drop a valid image, video, or audio file')
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileUpload(file)
    }
  }

  return (
    <>
      <div className="divider m-1 text-sm text-gray-500">OR</div>
      <div className="flex w-full items-center justify-center">
        <label
          htmlFor="dropzone-file"
          className={`flex h-36 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
            isDragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}>
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <MdCloudUpload
              size={30}
              className={`mb-2 ${isDragOver ? 'text-blue-500' : 'text-gray-500'}`}
            />
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">Picture, Video or Audio (MAX. 4MB)</p>
          </div>
          <input
            id="dropzone-file"
            type="file"
            className="hidden"
            onChange={handleFileInputChange}
            accept="image/*,video/*,audio/*"
          />
        </label>
      </div>
    </>
  )
}

interface MediaFormProps {
  onSubmit: (url: string, type: MediaType) => void
  editor: any
}

const MediaForm: React.FC<MediaFormProps> = ({ onSubmit, editor }) => {
  const { metadata: docMetadata } = useStore((state) => state.settings)
  const [mediaURL, setMediaURL] = useState('')
  const [mediaType, setMediaType] = useState<MediaType>('Picture')
  const inputRef = useRef<HTMLInputElement>(null)
  const { uploadFile } = useUploadManager(editor)
  const { close } = usePopoverState()

  // Listen for clipboard file uploads from the extension
  useEffect(() => {
    const handleEditorFileUpload = (event: CustomEvent) => {
      const { file, editor: eventEditor } = event.detail

      // Only handle if this is for our editor instance
      if (eventEditor === editor && file && docMetadata) {
        uploadFile(file, docMetadata)
      }
    }

    document.addEventListener('editorFileUpload', handleEditorFileUpload as EventListener)

    return () => {
      document.removeEventListener('editorFileUpload', handleEditorFileUpload as EventListener)
    }
  }, [editor, uploadFile, docMetadata])

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(timer)
  }, [mediaType])

  const handleURLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    if (!url) {
      setMediaURL('')
      return
    }

    setMediaType(detectMediaType(url))
    setMediaURL(url)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mediaURL.trim()) {
      onSubmit(mediaURL, mediaType)
      close()
    }
  }

  const handleFileUpload = (file: File) => {
    if (file && docMetadata) {
      uploadFile(file, docMetadata)
      close()
    }
  }

  const IconComponent = MEDIA_CONFIG[mediaType].icon

  return (
    <div className="w-96 px-3 py-1 pt-0">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Media Type Selector */}
        <div className="w-full">
          <h3 className="label-text mb-2 font-medium">Media Type</h3>
          <div className="join bg-base-300 relative z-1 flex rounded-md">
            {Object.keys(MEDIA_CONFIG).map((type) => (
              <MediaTypeButton
                key={type}
                type={type as MediaType}
                isActive={mediaType === type}
                onClick={() => setMediaType(type as MediaType)}
              />
            ))}
          </div>
        </div>

        {/* URL Input */}
        <div className="form-control">
          <div className="join w-full">
            <TextInput
              ref={inputRef}
              type="url"
              placeholder={`Enter ${mediaType} URL...`}
              value={mediaURL}
              onChange={handleURLChange}
              startIcon={<IconComponent size={18} />}
              wrapperClassName="flex-1"
              className="join-item rounded-r-none"
            />
            <Button
              variant="neutral"
              className="join-item"
              type="submit"
              disabled={!mediaURL.trim()}>
              Insert
            </Button>
          </div>
        </div>

        {/* File Upload */}
        <UploadDropzone onFileUpload={handleFileUpload} />
      </form>
    </div>
  )
}

const InsertMultimediaForm = () => {
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const insertMedia = useCallback(
    async (mediaUrl: string, mediaType: MediaType) => {
      if (!mediaUrl || !editor) return

      try {
        const command = MEDIA_CONFIG[mediaType].command

        if (mediaType === 'Picture') {
          const img = new Image()
          img.crossOrigin = 'anonymous'

          const imageData = await new Promise<ImageDimensions>((resolve) => {
            img.onload = () => resolve(calculateAdaptiveDimensions(img.width, img.height))
            img.onerror = () => resolve({ width: 400, height: 300, aspectRatio: 4 / 3 })
            img.src = mediaUrl
          })

          // @ts-ignore
          editor
            .chain()
            .focus()
            [command]({
              src: mediaUrl,
              width: imageData.width,
              height: imageData.height
            })
            .run()
        } else {
          // @ts-ignore
          editor.chain().focus()[command]({ src: mediaUrl }).run()
        }
      } catch (error) {
        console.error('Media insertion error:', error)
        // @ts-ignore
        editor.chain().focus()[MEDIA_CONFIG[mediaType].command]({ src: mediaUrl }).run()
      }
    },
    [editor]
  )

  return <MediaForm onSubmit={insertMedia} editor={editor} />
}

export default InsertMultimediaForm
