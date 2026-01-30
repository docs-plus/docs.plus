import { Extension } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { buildOptimizedDecorations } from './decoration'
import {
  BuildDecorationsFunction,
  createDecorationPluginProps,
  createDecorationPluginState} from './decorationHelpers'

export interface MediaResizeGripperOptions {
  acceptedNodes: string[]
}

export const MediaResizeGripper = Extension.create<MediaResizeGripperOptions>({
  name: 'MediaResizeGripper',

  addOptions() {
    return {
      acceptedNodes: ['Image']
    }
  },

  addProseMirrorPlugins() {
    const { acceptedNodes } = this.options
    const editor = this.editor

    // Create optimized decoration builder function
    const buildDecorations: BuildDecorationsFunction = (doc: ProseMirrorNode) => {
      return buildOptimizedDecorations(acceptedNodes, doc, editor)
    }

    return [
      new Plugin({
        key: new PluginKey('MediaResizeGripper'),
        state: createDecorationPluginState(buildDecorations, acceptedNodes, () => {
          // Optional initialization callback
          // console.log('MediaResizeGripper plugin initialized')
        }),
        props: createDecorationPluginProps()
      })
    ]
  }
})
