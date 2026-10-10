import { Banner } from '@components/ui/Banner'
import Button from '@components/ui/Button'
import { mergeAttributes, Node } from '@tiptap/core'
import { NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import React from 'react'

import { createMediaUploadPlaceholderPlugin } from './mediaUploadPlaceholderPlugin'

export {
  addUploadPlaceholder,
  findUploadPlaceholderPos,
  removeUploadPlaceholder
} from './mediaUploadPlaceholderPlugin'

interface MediaAttributes {
  fileName: string
  uploadId: string
}

// Node views only render legacy zombie placeholders left in stored docs by past
// sessions (in-flight uploads are widget decorations now). Their upload and blob
// URL died with that session, so they show a static state that Remove deletes.
const MediaUploadPlaceholderComponent: React.FC<NodeViewProps> = ({ node, deleteNode }) => {
  const { fileName, uploadId } = node.attrs as MediaAttributes

  return (
    <NodeViewWrapper className="media-upload-placeholder" data-upload-id={uploadId}>
      {/* `note`, not the warning default `status`: no live region may sit inside the editor. */}
      <div className="my-4">
        <Banner
          tone="warning"
          role="note"
          title="Upload did not finish"
          className="mx-auto max-w-md"
          actions={
            <Button variant="quiet" onClick={() => deleteNode?.()}>
              Remove
            </Button>
          }>
          {fileName && <span className="truncate">{fileName}</span>}
        </Banner>
      </div>
    </NodeViewWrapper>
  )
}

// The node type stays registered so stored docs containing zombie placeholders
// from past sessions remain valid under enableContentCheck; nothing inserts it anymore.
// It has no parseHTML, so a paste can never create it.
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
