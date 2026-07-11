import {
  createMappablePosition as createCorePosition,
  type Editor,
  getUpdatedPosition as getCoreUpdatedPosition,
  type MappablePosition
} from '@tiptap/core'
import {
  createMappablePosition as createCollabPosition,
  getUpdatedPosition as getCollabUpdatedPosition
} from '@tiptap/extension-collaboration'
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { createRoot, type Root } from 'react-dom/client'

import { type FileType, PlaceholderBody } from './MediaUploadPlaceholderBody'

export interface UploadPlaceholderSpec {
  uploadId: string
  fileName: string
  fileType: FileType
  localUrl?: string
  width?: number
  height?: number
  onCancel: () => void
}

type UploadPlaceholderMeta =
  { add: UploadPlaceholderSpec & { pos: number } } | { remove: { uploadId: string } }

interface UploadPlaceholderEntry {
  spec: UploadPlaceholderSpec
  position: MappablePosition
}

interface UploadPlaceholderState {
  entries: Map<string, UploadPlaceholderEntry>
  decorations: DecorationSet
}

const uploadPlaceholderPluginKey = new PluginKey<UploadPlaceholderState>(
  'mediaUploadPlaceholderWidgets'
)

const widgetRoots = new WeakMap<HTMLElement, Root>()

const createUploadWidget = (spec: UploadPlaceholderSpec): HTMLElement => {
  const dom = document.createElement('div')
  dom.className = 'media-upload-placeholder'
  dom.dataset.uploadId = spec.uploadId
  const root = createRoot(dom)
  widgetRoots.set(dom, root)
  root.render(
    <PlaceholderBody
      progress={0}
      fileName={spec.fileName}
      fileType={spec.fileType}
      localUrl={spec.localUrl}
      width={spec.width}
      height={spec.height}
      onCancel={spec.onCancel}
    />
  )
  return dom
}

// `key` makes rebuilt decorations eq to their predecessors, so prosemirror-view
// keeps the widget DOM and React root alive across per-transaction rebuilds.
const createWidgetDecoration = (pos: number, spec: UploadPlaceholderSpec): Decoration =>
  Decoration.widget(pos, () => createUploadWidget(spec), {
    key: spec.uploadId,
    uploadId: spec.uploadId,
    stopEvent: (event: Event) => event.type === 'click' || event.type === 'mousedown',
    destroy: (node) => {
      const root = widgetRoots.get(node as HTMLElement)
      // React rejects synchronous unmount while a render is flushing
      if (root) queueMicrotask(() => root.unmount())
    }
  })

/** In-flight placeholder: a local widget decoration so it never enters the shared Y.Doc or undo stack. */
export const addUploadPlaceholder = (editor: Editor, spec: UploadPlaceholderSpec): void => {
  const { state, view } = editor
  view.dispatch(
    state.tr.setMeta(uploadPlaceholderPluginKey, { add: { ...spec, pos: state.selection.from } })
  )
}

export const removeUploadPlaceholder = (editor: Editor, uploadId: string): void => {
  editor.view.dispatch(
    editor.state.tr.setMeta(uploadPlaceholderPluginKey, { remove: { uploadId } })
  )
}

export const findUploadPlaceholderPos = (state: EditorState, uploadId: string): number | null => {
  const entry = uploadPlaceholderPluginKey.getState(state)?.entries.get(uploadId)
  return entry ? entry.position.position : null
}

/**
 * `hasCollaboration` is resolved per-editor by the node's addProseMirrorPlugins:
 * the collab position helpers read ySyncPluginKey state and throw when ySync is
 * absent (e.g. the /editor playground on plain UndoRedo), so we fall back to the
 * core helpers, which map through the transaction alone.
 */
export const createMediaUploadPlaceholderPlugin = (hasCollaboration: boolean) =>
  new Plugin<UploadPlaceholderState>({
    key: uploadPlaceholderPluginKey,
    state: {
      init: () => ({ entries: new Map(), decorations: DecorationSet.empty }),
      apply(tr, value, _old, newState) {
        const meta = tr.getMeta(uploadPlaceholderPluginKey) as UploadPlaceholderMeta | undefined
        if (!meta && (value.entries.size === 0 || !tr.docChanged)) return value

        // Remote peer edits and collab undo/redo arrive as whole-document
        // ReplaceSteps, which plain tr.mapping treats as deleting every widget;
        // collab-aware mapping re-resolves through Y.js relative positions.
        const entries = new Map<string, UploadPlaceholderEntry>()
        for (const [uploadId, entry] of value.entries) {
          const updated = hasCollaboration
            ? getCollabUpdatedPosition(entry.position, tr, newState)
            : getCoreUpdatedPosition(entry.position, tr)
          if (updated.mapResult?.deleted) continue
          entries.set(uploadId, { spec: entry.spec, position: updated.position })
        }

        if (meta) {
          if ('add' in meta) {
            const { pos, ...spec } = meta.add
            entries.set(spec.uploadId, {
              spec,
              position: hasCollaboration
                ? createCollabPosition(pos, newState)
                : createCorePosition(pos)
            })
          } else {
            entries.delete(meta.remove.uploadId)
          }
        }

        const decorations = DecorationSet.create(
          tr.doc,
          [...entries.values()].map((entry) =>
            createWidgetDecoration(entry.position.position, entry.spec)
          )
        )
        return { entries, decorations }
      }
    },
    props: {
      decorations(state) {
        return uploadPlaceholderPluginKey.getState(state)?.decorations ?? DecorationSet.empty
      }
    }
  })
