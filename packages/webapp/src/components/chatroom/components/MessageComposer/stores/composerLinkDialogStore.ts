import { applyCreate } from '@components/TipTap/hyperlinkPopovers/commands/applyCreate'
import { applyEdit } from '@components/TipTap/hyperlinkPopovers/commands/applyEdit'
import { removeHyperlinkAtPos } from '@components/TipTap/hyperlinkPopovers/commands/removeHyperlinkAtPos'
import { getHyperlinkDisplayText } from '@components/TipTap/hyperlinkPopovers/linkMarkUtils'
import type { DocSelectionRange, HyperlinkResult } from '@components/TipTap/hyperlinkPopovers/types'
import type { HyperlinkAttributes } from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'
import { create } from 'zustand'

import { useComposerEmojiPanelStore } from './composerEmojiPanelStore'
import { clearComposerLinkSelection } from './composerLinkSelectionRef'

export type ComposerLinkPhase = 'idle' | 'preview' | 'create' | 'edit'

/** Escape / Enter guards — same pattern as `isMentionSuggestionPopupVisible`. */
export const isComposerLinkDialogOpen = (): boolean =>
  useComposerLinkDialogStore.getState().phase !== 'idle'

/** Close other composer overlays before opening link dialog. Symmetric closure
 *  with the emoji panel; `composerEmojiPanelStore.open()` mirrors this in the
 *  opposite direction. */
const dismissOtherComposerOverlays = () => {
  const emoji = useComposerEmojiPanelStore.getState()
  if (emoji.isOpen) emoji.close()
}

type PreviewPayload = {
  href: string
  editor: Editor
  nodePos: number
  validate?: (url: string) => boolean
}

type CreatePayload = {
  editor: Editor
  extensionName: string
  attributes: Partial<HyperlinkAttributes>
  validate?: (url: string) => boolean
  initialHref: string
  initialText: string
  selection?: DocSelectionRange
}

type EditPayload = {
  editor: Editor
  nodePos: number
  validate?: (url: string) => boolean
  initialHref: string
  initialText: string
  returnToPreview?: PreviewPayload
}

type HistoryState = { composerLinkDialog: true }

const pushIfIdle = (phase: ComposerLinkPhase) => {
  if (phase !== 'idle' || typeof window === 'undefined') return
  window.history.pushState({ composerLinkDialog: true } satisfies HistoryState, '')
}

const popIfOurs = () => {
  if (typeof window === 'undefined') return
  const s = window.history.state as HistoryState | null
  if (s?.composerLinkDialog) window.history.back()
}

const refocus = (editor: Editor | null | undefined) => {
  if (editor && !editor.isDestroyed) editor.commands.focus()
}

export const useComposerLinkDialogStore = create<{
  phase: ComposerLinkPhase
  preview: PreviewPayload | null
  create: CreatePayload | null
  edit: EditPayload | null
  openPreview: (p: PreviewPayload) => void
  openCreate: (p: CreatePayload) => void
  openEdit: (p: EditPayload) => void
  openEditFromPreview: () => void
  save: (result: HyperlinkResult) => boolean
  removeLink: () => void
  cancel: () => void
  close: (opts?: { refocus?: boolean }) => void
}>((set, get) => ({
  phase: 'idle',
  preview: null,
  create: null,
  edit: null,

  openPreview: (p) => {
    dismissOtherComposerOverlays()
    pushIfIdle(get().phase)
    set({ phase: 'preview', preview: p, create: null, edit: null })
  },

  openCreate: (p) => {
    dismissOtherComposerOverlays()
    pushIfIdle(get().phase)
    set({ phase: 'create', create: p, preview: null, edit: null })
  },

  openEdit: (p) => {
    dismissOtherComposerOverlays()
    pushIfIdle(get().phase)
    set({ phase: 'edit', edit: p, preview: null, create: null })
  },

  openEditFromPreview: () => {
    const preview = get().preview
    if (!preview) return
    set({
      phase: 'edit',
      preview: null,
      create: null,
      edit: {
        editor: preview.editor,
        nodePos: preview.nodePos,
        initialHref: preview.href,
        initialText: getHyperlinkDisplayText(preview.editor, preview.nodePos),
        validate: preview.validate,
        returnToPreview: preview
      }
    })
  },

  save: (result) => {
    const { phase, create, edit } = get()
    if (phase === 'create' && create) {
      const trimmedText = result.text?.trim() ?? ''
      const textChanged = trimmedText !== create.initialText.trim()
      const ok = applyCreate(
        {
          editor: create.editor,
          extensionName: create.extensionName,
          attributes: create.attributes,
          selection: create.selection
        },
        {
          href: result.href,
          text: create.selection && !textChanged ? undefined : trimmedText || undefined
        }
      )
      if (ok) get().close()
      return ok
    }
    if (phase === 'edit' && edit) {
      const ok = applyEdit(
        { editor: edit.editor, nodePos: edit.nodePos },
        { href: result.href, text: result.text?.trim() || undefined }
      )
      if (ok) get().close()
      return ok
    }
    return false
  },

  removeLink: () => {
    const preview = get().preview
    if (!preview) return
    removeHyperlinkAtPos({ editor: preview.editor, nodePos: preview.nodePos })
    get().close({ refocus: true })
  },

  cancel: () => {
    const { phase, edit, create } = get()
    if (phase === 'edit' && edit?.returnToPreview) {
      set({ phase: 'preview', preview: edit.returnToPreview, edit: null, create: null })
      return
    }
    get().close({ refocus: Boolean(create || edit) })
  },

  close: (opts) => {
    if (get().phase === 'idle') return
    // Order matters: capture editor handle BEFORE clearing state, and clear
    // state BEFORE popIfOurs() so a re-entrant popstate listener hits the
    // idle short-circuit cleanly instead of racing the editor lookup.
    const editor = get().preview?.editor ?? get().create?.editor ?? get().edit?.editor
    set({ phase: 'idle', preview: null, create: null, edit: null })
    clearComposerLinkSelection()
    popIfOurs()
    if (opts?.refocus) refocus(editor)
  }
}))
