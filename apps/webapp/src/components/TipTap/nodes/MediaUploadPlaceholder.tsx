import { mergeAttributes, Node } from '@tiptap/core'
import { NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import React from 'react'

import { type FileType, PlaceholderBody } from './MediaUploadPlaceholderBody'
import { createMediaUploadPlaceholderPlugin } from './mediaUploadPlaceholderPlugin'

export {
  addUploadPlaceholder,
  findUploadPlaceholderPos,
  removeUploadPlaceholder
} from './mediaUploadPlaceholderPlugin'

interface MediaAttributes {
  progress: number
  fileName: string
  fileType: FileType
  uploadId: string
  localUrl?: string
  width?: number
  height?: number
}

// Node views only render legacy zombie placeholders left in stored docs by past
// sessions (in-flight uploads are widget decorations now); Cancel just removes them.
const MediaUploadPlaceholderComponent: React.FC<NodeViewProps> = ({ node, deleteNode }) => {
  const { progress, fileName, fileType, uploadId, localUrl, width, height } =
    node.attrs as MediaAttributes

  return (
    <NodeViewWrapper className="media-upload-placeholder" data-upload-id={uploadId}>
      <PlaceholderBody
        progress={progress}
        fileName={fileName}
        fileType={fileType}
        localUrl={localUrl}
        width={width}
        height={height}
        onCancel={() => deleteNode?.()}
      />
    </NodeViewWrapper>
  )
}

// The node type stays registered so stored docs containing zombie placeholders
// from past sessions remain valid under enableContentCheck; nothing inserts it anymore.
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
  },

  addProseMirrorPlugins() {
    const hasCollaboration = this.editor.extensionManager.extensions.some(
      (e) => e.name === 'collaboration'
    )
    return [createMediaUploadPlaceholderPlugin(hasCollaboration)]
  }
})
