import { SheetLayout } from '@components/SheetLayout'
import Button, { segmentClassName } from '@components/ui/Button'
import { ContextMenuDivider } from '@components/ui/ContextMenu'
import { ContextMenuRowButton } from '@components/ui/ContextMenuRowButton'
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
import { Icons } from '@icons'
import { type SheetDataMap, useSheetStore } from '@stores'
import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { type ReactNode, useEffect, useId, useState } from 'react'

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

/** A labelled button group: the same 13/600 label as the Caption and Margin fields. */
function ChoiceGroup({
  label,
  gridClassName,
  children
}: {
  label: string
  gridClassName: string
  children: ReactNode
}) {
  const labelId = useId()
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <p id={labelId} className="text-meta text-base-content font-semibold">
        {label}
      </p>
      <div className={gridClassName}>{children}</div>
    </div>
  )
}

/** A segment: `segmentClassName`, as in the Documents view toggle. Utilities beat a kept touch hover. */
function ChoiceButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      role="radio"
      aria-checked={active}
      className={segmentClassName(active)}
      onClick={onClick}>
      {children}
    </Button>
  )
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
      body="stack">
      {isXEmbed && (
        <>
          <ChoiceGroup label="Size" gridClassName="grid grid-cols-3 gap-2">
            {X_EMBED_SIZE_OPTIONS.map(({ id, label, maxwidth }) => (
              <ChoiceButton key={id} active={activeSize === id} onClick={() => apply({ maxwidth })}>
                {label}
              </ChoiceButton>
            ))}
          </ChoiceGroup>

          <ChoiceGroup label="Theme" gridClassName="grid grid-cols-2 gap-2">
            {X_EMBED_THEME_OPTIONS.map(({ id, label }) => (
              <ChoiceButton
                key={id}
                active={activeTheme === id}
                onClick={() => apply({ theme: id })}>
                {label}
              </ChoiceButton>
            ))}
          </ChoiceGroup>
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

      <ChoiceGroup label="Placement" gridClassName="grid grid-cols-2 gap-2">
        {MEDIA_PLACEMENT_OPTIONS.map(({ id, label }) => (
          <ChoiceButton
            key={id}
            active={activePlacement === id}
            onClick={() => apply(getMediaPlacementAttrs(id, currentMargin))}>
            {label}
          </ChoiceButton>
        ))}
      </ChoiceGroup>

      <Select
        label="Margin"
        size="sm"
        value={currentMargin}
        onChange={(value) => apply({ margin: value })}
        options={MEDIA_MARGIN_OPTIONS.map(({ value, label }) => ({ value, label }))}
      />

      <div className="-mx-2 flex flex-col">
        {showComment && (
          <ContextMenuRowButton
            rowClassName="min-h-12"
            icon={<Icons.comment size={16} />}
            onClick={runComment}>
            Comment in chat
          </ContextMenuRowButton>
        )}
        {showViewOriginal && (
          <ContextMenuRowButton
            rowClassName="min-h-12"
            icon={<Icons.externalLink size={16} />}
            onClick={() => runAction(viewOriginalMedia)}>
            View original
          </ContextMenuRowButton>
        )}
        {isDownloadable(nodeType) && (
          <ContextMenuRowButton
            rowClassName="min-h-12"
            icon={<Icons.download size={16} />}
            onClick={() => runAction(downloadMedia)}>
            Download
          </ContextMenuRowButton>
        )}
        <ContextMenuRowButton
          rowClassName="min-h-12"
          icon={<Icons.copy size={16} />}
          onClick={() => runAction(copyMediaNode)}>
          Copy
        </ContextMenuRowButton>
        <ContextMenuDivider as="div" />
        <ContextMenuRowButton
          icon={<Icons.trash size={16} />}
          variant="danger"
          rowClassName="min-h-12"
          onClick={() => runAction(removeMediaNode)}>
          Delete
        </ContextMenuRowButton>
      </div>
    </SheetLayout>
  )
}
