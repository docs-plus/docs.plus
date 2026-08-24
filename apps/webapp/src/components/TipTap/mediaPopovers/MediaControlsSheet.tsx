import { SheetLayout } from '@components/SheetLayout'
import { SheetPrimaryFooter } from '@components/SheetPrimaryFooter'
import Button from '@components/ui/Button'
import Select from '@components/ui/Select'
import Textarea from '@components/ui/Textarea'
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
  const [caption, setCaption] = useState('')

  useEffect(() => {
    const syncAttrs = () => {
      const nodePos = findMediaNodePosByKeyId(editor, keyId)
      if (nodePos == null) {
        closeSheet()
        return
      }
      const attrs = editor.state.doc.nodeAt(nodePos)?.attrs ?? {}
      setCurrent(attrs)
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

  useEffect(() => {
    const nodePos = findMediaNodePosByKeyId(editor, keyId)
    if (nodePos == null) return
    setCaption(String(editor.state.doc.nodeAt(nodePos)?.attrs.caption ?? ''))
  }, [editor, keyId])

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
      footer={<SheetPrimaryFooter label="Done" onClick={closeSheet} />}>
      <div className={`flex flex-col gap-4 py-3 ${sheetBodyPadClassName}`}>
        {isXEmbed && (
          <>
            <div>
              <p className="text-base-content/70 mb-2 text-sm font-medium">Size</p>
              <div className="grid grid-cols-3 gap-2">
                {X_EMBED_SIZE_OPTIONS.map(({ id, label, maxwidth }) => (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant="primary"
                    btnStyle={activeSize === id ? undefined : 'outline'}
                    onClick={() => apply({ maxwidth })}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-base-content/70 mb-2 text-sm font-medium">Theme</p>
              <div className="grid grid-cols-2 gap-2">
                {X_EMBED_THEME_OPTIONS.map(({ id, label }) => (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant="primary"
                    btnStyle={activeTheme === id ? undefined : 'outline'}
                    onClick={() => apply({ theme: id })}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}

        <Textarea
          label="Caption"
          labelPosition="above"
          size="sm"
          rows={2}
          placeholder="Add a caption…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => apply({ caption: caption.trim() || null })}
        />

        {showComment && (
          <Button type="button" size="sm" variant="primary" shape="block" onClick={runComment}>
            Comment in chat
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2">
          {showViewOriginal && (
            <Button
              type="button"
              size="sm"
              variant="neutral"
              btnStyle="outline"
              onClick={() => runAction(viewOriginalMedia)}>
              View original
            </Button>
          )}
          {isDownloadable(nodeType) && (
            <Button
              type="button"
              size="sm"
              variant="neutral"
              btnStyle="outline"
              onClick={() => runAction(downloadMedia)}>
              Download
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="neutral"
            btnStyle="outline"
            onClick={() => runAction(copyMediaNode)}>
            Copy
          </Button>
          <Button
            type="button"
            size="sm"
            variant="error"
            btnStyle="outline"
            onClick={() => runAction(removeMediaNode)}>
            Delete
          </Button>
        </div>

        <div>
          <p className="text-base-content/70 mb-2 text-sm font-medium">Placement</p>
          <div className="grid grid-cols-2 gap-2">
            {MEDIA_PLACEMENT_OPTIONS.map(({ id, label }) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant="primary"
                btnStyle={activePlacement === id ? undefined : 'outline'}
                onClick={() => apply(getMediaPlacementAttrs(id, currentMargin))}>
                {label}
              </Button>
            ))}
          </div>
        </div>

        <Select
          label="Margin"
          size="sm"
          value={currentMargin}
          onChange={(value) => apply({ margin: value })}
          options={MEDIA_MARGIN_OPTIONS.map(({ value, label }) => ({ value, label }))}
        />
      </div>
    </SheetLayout>
  )
}
