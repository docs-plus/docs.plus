import { mergeAttributes,Node } from '@tiptap/core'
import { NodeViewProps, NodeViewWrapper,ReactNodeViewRenderer } from '@tiptap/react'
import React from 'react'
import { HiOutlineMusicalNote, HiOutlinePhoto,HiOutlineVideoCamera } from 'react-icons/hi2'

// Constants
const CONTAINER_WIDTH = 400
const MIN_CONTAINER_SIZE = 120
const MIN_HEIGHT = 80
const ICON_CLASS = 'w-12 h-12 text-gray-400'

// Types
type FileType = 'image' | 'video' | 'audio'

interface MediaAttributes {
  progress: number
  fileName: string
  fileType: FileType
  uploadId: string
  localUrl?: string
  width?: number
  height?: number
}

// Sub-components
const FileTypeIcon: React.FC<{ fileType: FileType }> = ({ fileType }) => {
  const icons = {
    video: HiOutlineVideoCamera,
    audio: HiOutlineMusicalNote,
    image: HiOutlinePhoto
  }
  const IconComponent = icons[fileType] || icons.image
  return <IconComponent className={ICON_CLASS} />
}

const ProgressIndicator: React.FC<{ progress: number; compact?: boolean }> = ({
  progress,
  compact = false
}) => (
  <div
    className={`flex items-center gap-${compact ? '1' : '2'} rounded-md bg-black/50 p-${compact ? '1' : '2'} px-${compact ? '1.5' : '3'}`}>
    <span className={`loading loading-spinner loading-${compact ? 'xs' : 'sm'} text-white`} />
    <span className={`text-${compact ? 'xs' : 'sm'} font-bold text-white`}>
      {Math.round(progress)}%
    </span>
  </div>
)

const CancelButton: React.FC<{ onCancel: () => void; compact?: boolean }> = ({
  onCancel,
  compact = false
}) => (
  <button
    type="button"
    onClick={onCancel}
    className={`btn btn-xs cursor-pointer bg-black/60 text-white hover:bg-black/90 ${compact ? 'btn-circle' : ''}`}
    title="Cancel upload">
    {compact ? '✕' : 'Cancel'}
  </button>
)

const ImagePreview: React.FC<{
  localUrl: string
  fileName: string
  width: number
  height: number
  progress: number
  onCancel: () => void
}> = ({ localUrl, fileName, width, height, progress, onCancel }) => {
  const shouldScale = width > CONTAINER_WIDTH

  if (shouldScale) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-md bg-gray-100"
        style={{ aspectRatio: `${width} / ${height}` }}>
        <img src={localUrl} alt={fileName} className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute top-2 right-2">
            <CancelButton onCancel={onCancel} />
          </div>
          <div className="absolute right-2 bottom-2">
            <ProgressIndicator progress={progress} />
          </div>
        </div>
      </div>
    )
  }

  const containerSize = Math.max(width, MIN_CONTAINER_SIZE)
  const containerHeight = Math.max(height, MIN_HEIGHT)

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-md bg-gray-100"
      style={{ width: containerSize, height: containerHeight }}>
      <img src={localUrl} alt={fileName} className="mx-auto" style={{ width, height }} />
      <div className="absolute inset-0 flex items-center justify-center">
        {progress < 100 && (
          <div className="absolute top-1 right-1">
            <CancelButton onCancel={onCancel} compact />
          </div>
        )}
        <div className="absolute right-1 bottom-1 left-1">
          <ProgressIndicator progress={progress} compact />
        </div>
      </div>
    </div>
  )
}

const IconFallback: React.FC<{
  fileType: FileType
  fileName: string
  progress: number
  onCancel: () => void
}> = ({ fileType, fileName, progress, onCancel }) => (
  <div className="relative my-4 overflow-hidden rounded-lg bg-gray-100">
    <div className="flex flex-col items-center justify-center px-8 py-16">
      <div className="mb-4">
        <FileTypeIcon fileType={fileType} />
      </div>
      <p className="mb-2 max-w-xs truncate text-center text-sm text-gray-600">{fileName}</p>
    </div>

    <div className="absolute right-4 bottom-4 flex items-center justify-center font-mono">
      {progress < 100 && (
        <div className="absolute top-2 right-2 z-10">
          <CancelButton onCancel={onCancel} />
        </div>
      )}
      <ProgressIndicator progress={progress} />
    </div>
  </div>
)

const MediaUploadPlaceholderComponent: React.FC<NodeViewProps> = ({ node, deleteNode }) => {
  const { progress, fileName, fileType, uploadId, localUrl, width, height } =
    node.attrs as MediaAttributes

  const handleCancel = () => {
    window.dispatchEvent(new CustomEvent('cancelUpload', { detail: { uploadId } }))
    deleteNode?.()
  }

  const canShowImagePreview = fileType === 'image' && localUrl && width && height

  return (
    <NodeViewWrapper className="media-upload-placeholder" data-upload-id={uploadId}>
      <div className="my-4 flex justify-center">
        {canShowImagePreview ? (
          <ImagePreview
            localUrl={localUrl}
            fileName={fileName}
            width={width}
            height={height}
            progress={progress}
            onCancel={handleCancel}
          />
        ) : (
          <IconFallback
            fileType={fileType as FileType}
            fileName={fileName}
            progress={progress}
            onCancel={handleCancel}
          />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default Node.create({
  name: 'mediaUploadPlaceholder',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      progress: { default: 0 },
      fileName: { default: '' },
      fileType: { default: 'image' },
      uploadId: { default: '' },
      localUrl: { default: null },
      width: { default: null },
      height: { default: null }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="media-upload-placeholder"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'media-upload-placeholder' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaUploadPlaceholderComponent)
  }
})
