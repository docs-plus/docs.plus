import { applyCreate } from '@components/TipTap/hyperlinkPopovers/commands/applyCreate'
import { applyEdit } from '@components/TipTap/hyperlinkPopovers/commands/applyEdit'
import { removeHyperlinkAtPos } from '@components/TipTap/hyperlinkPopovers/commands/removeHyperlinkAtPos'
import { getHyperlinkDisplayText } from '@components/TipTap/hyperlinkPopovers/linkMarkUtils'
import type { HyperlinkResult } from '@components/TipTap/hyperlinkPopovers/types'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import { create } from 'zustand'

import { dismissComposerEmojiAndMentionOverlays } from '../helpers/dismissComposerOverlays'
import type {
  ComposerLinkCreatePayload,
  ComposerLinkEditPayload,
  ComposerLinkPhase,
  ComposerLinkPreviewPayload
} from '../types'
import { clearComposerLinkSelection } from './composerLinkSelectionRef'

export type { ComposerLinkPhase } from '../types'

/** Escape / Enter guards — same pattern as `isMentionSuggestionPopupVisible`. */
export const isComposerLinkDialogOpen = (): boolean =>
  useComposerLinkDialogStore.getState().phase !== 'idle'

type HistoryState = { composerLinkDialog: true }

const pushIfIdle = (phase: ComposerLinkPhase) => {
  if (phase !== 'idle' || typeof window === 'undefined') return
  window.history.pushState({ composerLinkDialog: true } satisfies HistoryState, '')
}

const restoreHistoryTrap = () => {
  if (typeof window === 'undefined') return
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

const snapshotKeyboardWasOpen = (): boolean => useStore.getState().isKeyboardOpen

type LinkDialogOpenPayload = {
  preview: ComposerLinkPreviewPayload | null
  create: ComposerLinkCreatePayload | null
  edit: ComposerLinkEditPayload | null
}

/** Hardware/gesture back while the dialog is open. Edit-from-preview re-traps history. */
export const handleComposerLinkDialogPopState = (): void => {
  const { phase, edit, cancel } = useComposerLinkDialogStore.getState()
  if (phase === 'idle') return
  cancel()
  if (edit?.returnToPreview) restoreHistoryTrap()
}

export const useComposerLinkDialogStore = create<{
  phase: ComposerLinkPhase
  preview: ComposerLinkPreviewPayload | null
  create: ComposerLinkCreatePayload | null
  edit: ComposerLinkEditPayload | null
  /** Soft-keyboard state when the current dialog opened; drives refocus on close. */
  keyboardWasOpenAtOpen: boolean
  openPreview: (p: ComposerLinkPreviewPayload) => void
  openCreate: (p: ComposerLinkCreatePayload) => void
  openEdit: (p: ComposerLinkEditPayload) => void
  openEditFromPreview: () => void
  save: (result: HyperlinkResult) => boolean
  removeLink: () => void
  cancel: () => void
  close: (opts?: { refocus?: boolean }) => void
}>((set, get) => {
  const openLinkDialog = (
    phase: Exclude<ComposerLinkPhase, 'idle'>,
    payload: LinkDialogOpenPayload
  ) => {
    dismissComposerEmojiAndMentionOverlays()
    pushIfIdle(get().phase)
    set({
      phase,
      keyboardWasOpenAtOpen: snapshotKeyboardWasOpen(),
      ...payload
    })
  }

  return {
    phase: 'idle',
    preview: null,
    create: null,
    edit: null,
    keyboardWasOpenAtOpen: false,

    openPreview: (p) => openLinkDialog('preview', { preview: p, create: null, edit: null }),

    openCreate: (p) => openLinkDialog('create', { create: p, preview: null, edit: null }),

    openEdit: (p) => openLinkDialog('edit', { edit: p, preview: null, create: null }),

    openEditFromPreview: () => {
      const preview = get().preview
      if (!preview) return
      set({
        phase: 'edit',
        keyboardWasOpenAtOpen: snapshotKeyboardWasOpen(),
        preview: null,
        create: null,
        edit: {
          editor: preview.editor,
          nodePos: preview.nodePos,
          initialHref: preview.href,
          initialText: getHyperlinkDisplayText(preview.editor, { nodePos: preview.nodePos }),
          validate: preview.validate,
          returnToPreview: preview
        }
      })
    },

    save: (result) => {
      const { phase, create, edit, keyboardWasOpenAtOpen } = get()
      const commandOpts = { focus: keyboardWasOpenAtOpen }
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
          },
          commandOpts
        )
        if (ok) get().close({ refocus: keyboardWasOpenAtOpen })
        return ok
      }
      if (phase === 'edit' && edit) {
        const ok = applyEdit(
          { editor: edit.editor, nodePos: edit.nodePos, expectedHref: edit.initialHref },
          { href: result.href, text: result.text?.trim() || undefined },
          commandOpts
        )
        if (ok) get().close({ refocus: keyboardWasOpenAtOpen })
        return ok
      }
      return false
    },

    removeLink: () => {
      const preview = get().preview
      if (!preview) return
      removeHyperlinkAtPos({
        editor: preview.editor,
        nodePos: preview.nodePos,
        expectedHref: preview.href
      })
      get().close({ refocus: get().keyboardWasOpenAtOpen })
    },

    cancel: () => {
      const { phase, edit, keyboardWasOpenAtOpen } = get()
      if (phase === 'edit' && edit?.returnToPreview) {
        // Unmounting the focused URL field closes an open keyboard, so focus moves to
        // the composer in the same tap. The shell's focus trap lets it stay there.
        if (keyboardWasOpenAtOpen) refocus(edit.editor)
        set({ phase: 'preview', preview: edit.returnToPreview, edit: null, create: null })
        return
      }
      get().close({ refocus: keyboardWasOpenAtOpen })
    },

    close: (opts) => {
      if (get().phase === 'idle') return
      const editor = get().preview?.editor ?? get().create?.editor ?? get().edit?.editor
      const keyboardWasOpen = get().keyboardWasOpenAtOpen
      set({
        phase: 'idle',
        preview: null,
        create: null,
        edit: null,
        keyboardWasOpenAtOpen: false
      })
      clearComposerLinkSelection()
      popIfOurs()
      if (opts?.refocus && keyboardWasOpen) refocus(editor)
    }
  }
})
