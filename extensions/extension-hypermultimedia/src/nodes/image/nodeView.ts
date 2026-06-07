import type { Editor } from '@tiptap/core'
import { mergeAttributes } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view'

import { type CaptionHandle, createCaptionElement, readCaption } from '../../caption'
import {
  IMAGE_LAYOUT_FALLBACK,
  layoutAttrsChanged,
  parseLayoutDimensions,
  syncImageNodeLayout,
  wrapMediaWithLoadingShell
} from '../../loading'
import type { ImageOptions } from '../../types'
import { ignoreNodeViewSubtreeMutation } from '../../utils/ignoreNodeViewMutation'

export function createImageNodeView(options: ImageOptions, editor: Editor) {
  return ({
    node,
    HTMLAttributes,
    getPos
  }: {
    node: ProseMirrorNode
    HTMLAttributes: Record<string, unknown>
    getPos: () => number | undefined
  }): NodeView => {
    let attrsSnapshot = node.attrs
    const layoutRoot = document.createElement('div')
    layoutRoot.classList.add('hypermultimedia--image__content')
    if (node.attrs.keyId) {
      layoutRoot.setAttribute('data-key-id', String(node.attrs.keyId))
    }

    const dims = parseLayoutDimensions(node.attrs, IMAGE_LAYOUT_FALLBACK)

    const img = document.createElement('img')
    Object.entries(
      mergeAttributes(options.HTMLAttributes, HTMLAttributes, {
        src: node.attrs.src,
        alt: node.attrs.alt,
        title: node.attrs.title
      })
    ).forEach(([key, value]) => {
      if (value !== undefined && value !== null) img.setAttribute(key, String(value))
    })

    img.style.maxWidth = '100%'
    img.style.height = 'auto'

    const { dom: loadingHost, controller } = wrapMediaWithLoadingShell(
      editor,
      { kind: 'image', width: dims.width, height: dims.height },
      img,
      {
        bindLoad: {
          element: img,
          isAlreadyReady: () => img.complete && img.naturalWidth > 0
        }
      }
    )

    layoutRoot.append(loadingHost)
    syncImageNodeLayout({ wrapper: layoutRoot, attrs: node.attrs, loadingHost, img, dims })

    const caption: CaptionHandle = createCaptionElement({
      editor,
      getPos,
      initial: readCaption(node)
    })
    layoutRoot.append(caption.el)

    return {
      dom: layoutRoot,
      destroy: () => {
        controller.destroy()
        caption.destroy()
      },
      // The caption is a nested contenteditable the node view owns; PM must not
      // process its input/key/selection events or it deletes the selected node.
      stopEvent: (event: Event) => caption.el.contains(event.target as Node | null),
      ignoreMutation: (mutation: ViewMutationRecord) =>
        ignoreNodeViewSubtreeMutation(mutation, layoutRoot),
      update: (updatedNode: ProseMirrorNode) => {
        if (updatedNode.type.name !== 'image') return false
        if (updatedNode.attrs.src !== attrsSnapshot.src) return false

        if (layoutAttrsChanged(updatedNode.attrs, attrsSnapshot)) {
          syncImageNodeLayout({
            wrapper: layoutRoot,
            attrs: updatedNode.attrs,
            loadingHost,
            img
          })
        }

        caption.sync(readCaption(updatedNode))
        attrsSnapshot = updatedNode.attrs
        return true
      }
    }
  }
}
