import { selectPadOwnsKeyboard } from '@components/chatroom/utils/selectPadOwnsKeyboard'
import TextInput from '@components/ui/TextInput'
import { Icons } from '@icons'
import { useChatStore } from '@stores'
import type { Editor, EditorEvents } from '@tiptap/core'
import { isModShortcut } from '@utils/platform'
import { twMerge } from '@utils/twMerge'
import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { CARET_FIND_HIT_CAP, caretFindPluginKey } from '../extensions/caret-find'
import ToolbarButton from '../toolbar/ToolbarButton'
import { canOpenFind } from './canOpenFind'

type FindStatus = { open: boolean; query: string; count: number; current: number; capped: boolean }

const ICON_SIZE = 16

function readStatus(editor: Editor): FindStatus {
  const find = caretFindPluginKey.getState(editor.state)
  return {
    open: find?.open ?? false,
    query: find?.query ?? '',
    count: find?.hits.length ?? 0,
    current: find?.current ?? -1,
    capped: find?.capped ?? false
  }
}

function sameStatus(a: FindStatus, b: FindStatus): boolean {
  return (
    a.open === b.open &&
    a.query === b.query &&
    a.count === b.count &&
    a.current === b.current &&
    a.capped === b.capped
  )
}

function statusLabel(status: FindStatus): string {
  if (!status.query) return ''
  if (status.count === 0) return 'No results'
  const total = status.capped ? `${CARET_FIND_HIT_CAP}+` : String(status.count)
  return `${status.current + 1} of ${total}`
}

// Keeps focus (and the phone keyboard) in the find input when a bar button is pressed.
const keepInputFocus = (event: React.MouseEvent) => event.preventDefault()

/**
 * Pad find bar. It owns Mod-f while the pad editor is mounted and no modal hides it.
 * The polite status sits here, outside `.ProseMirror`, per TipTap/CLAUDE.md.
 */
const FindBar = ({ editor, variant }: { editor: Editor; variant: 'desktop' | 'mobile' }) => {
  const [status, setStatus] = useState<FindStatus>(() => readStatus(editor))
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const isDesktop = variant === 'desktop'
  const yieldsToChat = !canOpenFind(!isDesktop, useChatStore(selectPadOwnsKeyboard))

  useEffect(() => {
    const onTransaction = ({ transaction }: EditorEvents['transaction']) => {
      const next = readStatus(editor)
      if (transaction.getMeta(caretFindPluginKey)?.type !== 'open') {
        setStatus((prev) => (sameStatus(prev, next) ? prev : next))
        return
      }
      const active = document.activeElement
      if (active instanceof HTMLElement && active !== inputRef.current) {
        returnFocusRef.current = active
      }
      // Render and focus inside the same tap, or iOS keeps the keyboard down.
      flushSync(() => setStatus(next))
      inputRef.current?.focus()
      inputRef.current?.select()
    }

    editor.on('transaction', onTransaction)
    return () => {
      editor.off('transaction', onTransaction)
    }
  }, [editor])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModShortcut(event, 'f') || editor.isDestroyed) return
      // A modal dialog marks the pad aria-hidden; leave the key alone then.
      if (editor.view.dom.closest('[aria-hidden="true"], [inert]')) return
      if (!canOpenFind(!isDesktop, selectPadOwnsKeyboard(useChatStore.getState()))) return
      event.preventDefault()
      if (!event.repeat) editor.commands.openCaretFind()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [editor, isDesktop])

  // No editor refocus here: that would pull the keyboard away from the chat composer.
  useEffect(() => {
    if (!yieldsToChat || !status.open || editor.isDestroyed) return
    returnFocusRef.current = null
    editor.commands.closeCaretFind()
  }, [editor, yieldsToChat, status.open])

  const close = useCallback(() => {
    editor.commands.closeCaretFind()
    const returnTo = returnFocusRef.current
    returnFocusRef.current = null
    if (editor.isEditable) editor.view.focus()
    // A phone opener sits in the TOC drawer, which is closed by now.
    else if (returnTo?.isConnected && returnTo.checkVisibility?.() !== false) returnTo.focus()
  }, [editor])

  if (!status.open || yieldsToChat) return null

  const noHits = status.count === 0

  return (
    <div
      role="search"
      aria-label="Find in document"
      data-testid="caret-find-bar"
      className={twMerge(
        'caret-find-bar border-base-300 bg-base-100 flex min-w-0 items-center gap-1 border-b px-3 py-1.5',
        isDesktop ? 'justify-end' : 'w-full shrink-0'
      )}>
      <TextInput
        ref={inputRef}
        size="sm"
        aria-label="Find in document"
        placeholder="Find in document"
        data-testid="caret-find-input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        value={status.query}
        onChange={(event) => editor.commands.setCaretFindQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
            return
          }
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
          event.preventDefault()
          editor.commands.stepCaretFind(event.shiftKey ? -1 : 1)
        }}
        startIcon={<Icons.search size={ICON_SIZE} className="text-base-content/50" />}
        wrapperClassName={isDesktop ? 'w-64' : 'min-w-0 flex-1'}
        // iOS zooms the page on focus when an input's text is under 16px.
        className={isDesktop ? undefined : 'text-base'}
      />
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="caret-find-status"
        className="text-base-content/60 min-w-16 shrink-0 text-center text-xs tabular-nums">
        {statusLabel(status)}
      </span>
      <ToolbarButton
        aria-label="Previous match"
        tooltip={isDesktop ? 'Previous match (⇧+Enter)' : undefined}
        disabled={noHits}
        onMouseDown={keepInputFocus}
        onPress={() => editor.commands.stepCaretFind(-1)}>
        <Icons.chevronUp size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton
        aria-label="Next match"
        tooltip={isDesktop ? 'Next match (Enter)' : undefined}
        disabled={noHits}
        onMouseDown={keepInputFocus}
        onPress={() => editor.commands.stepCaretFind(1)}>
        <Icons.chevronDown size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton
        aria-label="Close find"
        tooltip={isDesktop ? 'Close (Esc)' : undefined}
        onPress={close}>
        <Icons.close size={ICON_SIZE} />
      </ToolbarButton>
    </div>
  )
}

export default memo(FindBar)
