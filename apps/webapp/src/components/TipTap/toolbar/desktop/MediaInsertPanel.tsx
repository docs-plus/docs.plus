import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import { usePopoverState } from '@components/ui/Popover'
import TextInput from '@components/ui/TextInput'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FaSoundcloud, FaVimeo, FaXTwitter, FaYoutube } from 'react-icons/fa6'
import { FiFilm } from 'react-icons/fi'
import { MdAudiotrack, MdCloudUpload, MdOutlineImage } from 'react-icons/md'

import {
  calculateAdaptiveDimensions,
  type ImageDimensions,
  uploadMediaFile
} from '../../mediaPopovers/uploadMediaFile'

const LOOM_URL_REGEX = /https?:\/\/(www\.)?loom\.com\/(share|embed)\/[a-zA-Z0-9]+(?:\?[^\s]*)?/

type MediaType =
  | 'Picture'
  | 'Video'
  | 'Audio'
  | 'Youtube'
  | 'Vimeo'
  | 'SoundCloud'
  | 'Loom'
  | 'x.com'

interface MediaConfig {
  icon: React.ComponentType<{ size?: number }>
  command: string
  regex: RegExp
}

type MediaCommandPayload = {
  src: string
  width?: number
  height?: number
}

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
    regex: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/
  },
  Vimeo: {
    icon: FaVimeo,
    command: 'setVimeo',
    regex: /(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com)\/?(.+)/
  },
  SoundCloud: {
    icon: FaSoundcloud,
    command: 'setSoundCloud',
    regex: /(?:https?:\/\/)?(?:www\.)?(?:soundcloud\.com)\/?(.+)/
  },
  Loom: {
    icon: FiFilm,
    command: 'setLoom',
    regex: LOOM_URL_REGEX
  },
  'x.com': {
    icon: FaXTwitter,
    command: 'setX',
    regex: /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/?(.+)/
  }
}

const detectMediaType = (url: string): MediaType => {
  for (const [type, config] of Object.entries(MEDIA_CONFIG)) {
    if (config.regex.test(url)) return type as MediaType
  }
  return 'Picture'
}

const runMediaCommand = (
  editor: Editor,
  commandName: string,
  payload: MediaCommandPayload
): void => {
  const chain = editor.chain().focus()
  switch (commandName) {
    case 'setImage':
      chain.setImage(payload).run()
      break
    case 'setVideo':
      chain.setVideo(payload).run()
      break
    case 'setAudio':
      chain.setAudio(payload).run()
      break
    case 'setYoutubeVideo':
      chain.setYoutubeVideo(payload).run()
      break
    case 'setVimeo':
      chain.setVimeo(payload).run()
      break
    case 'setSoundCloud':
      chain.setSoundCloud(payload).run()
      break
    case 'setLoom':
      chain.setLoom(payload).run()
      break
    case 'setX':
      chain.setX(payload).run()
      break
    default:
      throw new Error(`Unsupported media command: ${commandName}`)
  }
}

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
      className="join-item flex-1"
      onClick={onClick}
      startIcon={<IconComponent size={18} />}
      tooltip={type}
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
      <div className="divider text-base-content/50 m-1 text-sm">OR</div>
      <div className="flex w-full items-center justify-center">
        <label
          htmlFor="dropzone-file"
          className={`flex h-36 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
            isDragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-base-300 bg-base-200 hover:bg-base-300'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}>
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <MdCloudUpload
              size={30}
              className={`mb-2 ${isDragOver ? 'text-primary' : 'text-base-content/50'}`}
            />
            <p className="text-base-content/50 mb-2 text-sm">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-base-content/50 text-xs">Picture, Video or Audio (MAX. 4MB)</p>
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
  editor: Editor | null
}

const MediaForm: React.FC<MediaFormProps> = ({ onSubmit, editor }) => {
  const docMetadata = useStore((state) => state.settings.metadata)
  const [mediaURL, setMediaURL] = useState('')
  const [mediaType, setMediaType] = useState<MediaType>('Picture')
  const inputRef = useRef<HTMLInputElement>(null)
  const { close } = usePopoverState()

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
      void uploadMediaFile(editor, file, docMetadata)
      close()
    }
  }

  const IconComponent = MEDIA_CONFIG[mediaType].icon

  return (
    <div className="w-96 px-3 py-1 pt-0">
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <UploadDropzone onFileUpload={handleFileUpload} />
      </form>
    </div>
  )
}

const MediaInsertPanel = () => {
  const editor = useStore((state) => state.settings.editor.instance)

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

          runMediaCommand(editor, command, {
            src: mediaUrl,
            width: imageData.width,
            height: imageData.height
          })
        } else {
          runMediaCommand(editor, command, { src: mediaUrl })
        }
      } catch (error) {
        console.error('Media insertion error:', error)
        runMediaCommand(editor, MEDIA_CONFIG[mediaType].command, { src: mediaUrl })
      }
    },
    [editor]
  )

  return <MediaForm onSubmit={insertMedia} editor={editor ?? null} />
}

export default MediaInsertPanel
