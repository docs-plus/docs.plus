import { SheetFooter } from '@components/SheetFooter'
import { SheetLayout } from '@components/SheetLayout'
import {
  canViewOriginal,
  copyMediaNode,
  downloadMedia,
  getCurrentMediaPlacement,
  getMediaPlacementAttrs,
  isDownloadable,
  MEDIA_MARGIN_OPTIONS,
  MEDIA_PLACEMENT_OPTIONS,
  type MediaActionContext,
  removeMediaNode,
  resolveXEmbedSizeId,
  viewOriginalMedia,
  X_EMBED_SIZE_OPTIONS,
  X_EMBED_THEME_OPTIONS,
  type XEmbedTheme
} from '@docs.plus/extension-hypermultimedia'
import { type SheetDataMap, useSheetStore } from '@stores'
import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { sheetBodyPadClassName } from '@utils/sheetBodyPadding'
import { useEffect, useState } from 'react'

import { findMediaNodePosByKeyId } from './findMediaNodePosByKeyId'
import { publishMediaComment } from './mediaComment'

function setMediaAttrs(
  editor: Editor,
  keyId: string,
  attrs: Record<string, string | number | null>,
  closeSheet: () => void
): void {
  const nodePos = findMediaNodePosByKeyId(editor, keyId)
  if (nodePos == null) {
    closeSheet()
    return
  }

  const { state, dispatch } = editor.view
  const tr = state.tr
  if (!tr.doc.nodeAt(nodePos)) return
  for (const [key, value] of Object.entries(attrs)) {
    tr.setNodeAttribute(nodePos, key, value)
  }
  dispatch(tr)
}

/** Resolve a fresh `MediaActionContext` at action time so the node position is never stale. */
function buildActionContext(
  editor: Editor,
  keyId: string,
  nodeType: string,
  closeSheet: () => void
): MediaActionContext | null {
  const nodePos = findMediaNodePosByKeyId(editor, keyId)
  if (nodePos == null) return null
  const node = editor.state.doc.nodeAt(nodePos)
  if (!node) return null
  return {
    editor,
    nodeType,
    nodePos,
    attrs: node.attrs,
    wrapper: editor.view.dom as HTMLElement,
    close: closeSheet
  }
}

export default function MediaControlsSheet({ data }: { data: SheetDataMap['mediaControls'] }) {
  const { editor, keyId, nodeType } = data
  const closeSheet = useSheetStore((s) => s.closeSheet)
  const [current, setCurrent] = useState<Record<string, unknown>>({})

  useEffect(() => {
    const syncAttrs = () => {
      const nodePos = findMediaNodePosByKeyId(editor, keyId)
      if (nodePos == null) {
        closeSheet()
        return
      }
      setCurrent(editor.state.doc.nodeAt(nodePos)?.attrs ?? {})
    }

    // Selection-only transactions can't move the node or change its attrs — skip the doc scan.
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged) syncAttrs()
    }

    syncAttrs()
    editor.on('transaction', onTransaction)
    return () => {
      editor.off('transaction', onTransaction)
    }
  }, [editor, keyId, closeSheet])

  const currentMargin = String(current.margin ?? '0.5in')
  const activePlacement = getCurrentMediaPlacement(current)
  const activeSize = resolveXEmbedSizeId(current.maxwidth as number | null | undefined)
  const activeTheme = (current.theme as XEmbedTheme | undefined) ?? 'light'
  const isXEmbed = nodeType === 'x'

  const apply = (attrs: Record<string, string | number | null>) => {
    setMediaAttrs(editor, keyId, attrs, closeSheet)
  }

  const runAction = (fn: (ctx: MediaActionContext) => unknown) => {
    const ctx = buildActionContext(editor, keyId, nodeType, closeSheet)
    if (ctx) fn(ctx)
  }

  const viewCtx = buildActionContext(editor, keyId, nodeType, closeSheet)
  const showViewOriginal = viewCtx != null && canViewOriginal(viewCtx)
  const showComment = editor.isEditable

  const runComment = () =>
    runAction((ctx) => {
      closeSheet()
      publishMediaComment(ctx.editor, ctx.nodePos, ctx.nodeType, ctx.attrs)
    })

  return (
    <SheetLayout
      title={isXEmbed ? 'Post layout' : 'Media layout'}
      onClose={closeSheet}
      footer={
        <SheetFooter>
          <button
            type="button"
            className="btn btn-primary min-h-12 w-full text-base font-semibold"
            onClick={closeSheet}>
            Done
          </button>
        </SheetFooter>
      }>
      <div className={`flex flex-col gap-4 py-3 ${sheetBodyPadClassName}`}>
        {isXEmbed && (
          <>
            <div>
              <p className="text-base-content/70 mb-2 text-sm font-medium">Size</p>
              <div className="grid grid-cols-3 gap-2">
                {X_EMBED_SIZE_OPTIONS.map(({ id, label, maxwidth }) => (
                  <button
                    key={id}
                    type="button"
                    className={`btn btn-sm ${activeSize === id ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => apply({ maxwidth })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-base-content/70 mb-2 text-sm font-medium">Theme</p>
              <div className="grid grid-cols-2 gap-2">
                {X_EMBED_THEME_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={`btn btn-sm ${activeTheme === id ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => apply({ theme: id })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <p className="text-base-content/70 mb-2 text-sm font-medium">Caption</p>
          <textarea
            className="textarea textarea-sm w-full"
            rows={2}
            placeholder="Add a caption…"
            defaultValue={String(current.caption ?? '')}
            onBlur={(e) => apply({ caption: e.target.value.trim() || null })}
          />
        </div>

        {showComment && (
          <button type="button" className="btn btn-sm btn-primary w-full" onClick={runComment}>
            Comment in chat
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          {showViewOriginal && (
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => runAction(viewOriginalMedia)}>
              View original
            </button>
          )}
          {isDownloadable(nodeType) && (
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => runAction(downloadMedia)}>
              Download
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => runAction(copyMediaNode)}>
            Copy
          </button>
          <button
            type="button"
            className="btn btn-sm btn-error btn-outline"
            onClick={() => runAction(removeMediaNode)}>
            Delete
          </button>
        </div>

        <div>
          <p className="text-base-content/70 mb-2 text-sm font-medium">Placement</p>
          <div className="grid grid-cols-2 gap-2">
            {MEDIA_PLACEMENT_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`btn btn-sm ${activePlacement === id ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  const attrs = getMediaPlacementAttrs(id, currentMargin)
                  apply(attrs)
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-base-content/70 mb-2 text-sm font-medium">Margin</p>
          <select
            className="select select-sm w-full"
            value={currentMargin}
            onChange={(e) => apply({ margin: e.target.value })}>
            {MEDIA_MARGIN_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </SheetLayout>
  )
}
