import { selectPadOwnsKeyboard } from '@components/chatroom/utils/selectPadOwnsKeyboard'
import { popoverPanelClassName } from '@components/ui/Popover'
import TextInput from '@components/ui/TextInput'
import { useEntryExitTransition } from '@hooks/useEntryExitTransition'
import { Icons } from '@icons'
import { useChatStore } from '@stores'
import type { Editor, EditorEvents } from '@tiptap/core'
import { MOTION_OVERLAY_OUT_MS } from '@utils/motion'
import { isModShortcut } from '@utils/platform'
import { twMerge } from '@utils/twMerge'
import debounce from 'lodash/debounce'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { CARET_FIND_HIT_CAP, caretFindPluginKey } from '../extensions/caret-find'
import ToolbarButton from '../toolbar/ToolbarButton'
import ToolbarDivider from '../toolbar/ToolbarDivider'
import { canOpenFind } from './canOpenFind'

type FindStatus = { open: boolean; query: string; count: number; current: number; capped: boolean }

const ICON_SIZE = 16
// Screen readers hear the count after typing pauses, not on every keystroke.
const SPOKEN_COUNT_DELAY_MS = 500
// On a long pad, painting the hits costs more than a frame, so the search waits for a pause.
const QUERY_DELAY_MS = 100

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

// A closed status keeps the last count, so the exit fade never flashes "No results".
function nextStatus(prev: FindStatus, next: FindStatus): FindStatus {
  if (!next.open) return prev.open ? { ...prev, open: false } : prev
  return sameStatus(prev, next) ? prev : next
}

const isStepKey = (event: KeyboardEvent): boolean =>
  isModShortcut(event, 'g') || isModShortcut(event, 'g', { shift: true }) || event.key === 'F3'

// Keeps focus (and the phone keyboard) in the find input when a bar button is pressed.
const keepInputFocus = (event: React.MouseEvent) => event.preventDefault()

/** Mounts empty with the bar, so every open speaks its first count. */
function FindCountAnnouncer({ label }: { label: string }) {
  const [spoken, setSpoken] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSpoken(label), SPOKEN_COUNT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [label])
  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="caret-find-status"
      className="sr-only">
      {spoken}
    </span>
  )
}

/**
 * Pad find bar: floating L1 on desktop, a docked row on the phone. It owns Mod-f while the
 * pad editor is mounted and no modal hides it. The polite status sits here, outside
 * `.ProseMirror`, per TipTap/CLAUDE.md.
 */
const FindBar = ({ editor, variant }: { editor: Editor; variant: 'desktop' | 'mobile' }) => {
  const [status, setStatus] = useState<FindStatus>(() => readStatus(editor))
  const [draft, setDraft] = useState(status.query)
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const isDesktop = variant === 'desktop'
  const yieldsToChat = !canOpenFind(!isDesktop, useChatStore(selectPadOwnsKeyboard))
  const { mounted, shown, show, hide, nodeRef } = useEntryExitTransition({
    durationMs: MOTION_OVERLAY_OUT_MS
  })
  const wantsOpen = status.open && !yieldsToChat

  const sendQuery = useMemo(
    () =>
      debounce((query: string) => {
        if (!editor.isDestroyed) editor.commands.setCaretFindQuery(query)
      }, QUERY_DELAY_MS),
    [editor]
  )
  useEffect(() => () => sendQuery.cancel(), [sendQuery])

  // A step always runs on the query the user sees in the input.
  const step = useCallback(
    (direction: 1 | -1) => {
      sendQuery.flush()
      editor.commands.stepCaretFind(direction)
    },
    [editor, sendQuery]
  )

  useEffect(() => {
    const onTransaction = ({ transaction }: EditorEvents['transaction']) => {
      const next = readStatus(editor)
      if (transaction.getMeta(caretFindPluginKey)?.type !== 'open') {
        setStatus((prev) => nextStatus(prev, next))
        return
      }
      const active = document.activeElement
      if (active instanceof HTMLElement && active !== inputRef.current) {
        returnFocusRef.current = active
      }
      // Render and focus inside the same tap, or iOS keeps the keyboard down.
      flushSync(() => {
        setStatus(next)
        setDraft(next.query)
        show()
      })
      inputRef.current?.focus()
      inputRef.current?.select()
    }

    editor.on('transaction', onTransaction)
    return () => {
      editor.off('transaction', onTransaction)
    }
  }, [editor, show])

  useEffect(() => {
    if (wantsOpen && !mounted) show()
    else if (!wantsOpen && mounted) hide()
  }, [wantsOpen, mounted, show, hide])

  const close = useCallback(() => {
    sendQuery.flush()
    editor.commands.closeCaretFind()
    const returnTo = returnFocusRef.current
    returnFocusRef.current = null
    if (editor.isEditable) editor.view.focus()
    // A phone opener sits in the TOC drawer, which is closed by now.
    else if (returnTo?.isConnected && returnTo.checkVisibility?.() !== false) returnTo.focus()
  }, [editor, sendQuery])

  useEffect(() => {
    const onKeyDownCapture = (event: KeyboardEvent) => {
      if (editor.isDestroyed) return
      if (isModShortcut(event, 'f')) {
        // A modal dialog marks the pad aria-hidden; leave the key alone then.
        if (editor.view.dom.closest('[aria-hidden="true"], [inert]')) return
        if (!canOpenFind(!isDesktop, selectPadOwnsKeyboard(useChatStore.getState()))) return
        event.preventDefault()
        if (event.repeat) return
        sendQuery.flush()
        editor.commands.openCaretFind()
        return
      }
      if (!isStepKey(event) || event.isComposing) return
      if (!caretFindPluginKey.getState(editor.state)?.open) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (!nodeRef.current?.contains(target) && !editor.view.dom.contains(target)) return
      event.preventDefault()
      step(event.shiftKey ? -1 : 1)
    }

    window.addEventListener('keydown', onKeyDownCapture, true)
    return () => window.removeEventListener('keydown', onKeyDownCapture, true)
  }, [editor, isDesktop, nodeRef, sendQuery, step])

  // No editor refocus here: that would pull the keyboard away from the chat composer.
  useEffect(() => {
    if (!yieldsToChat || !status.open || editor.isDestroyed) return
    returnFocusRef.current = null
    sendQuery.flush()
    editor.commands.closeCaretFind()
  }, [editor, sendQuery, yieldsToChat, status.open])

  if (!mounted) return null

  const noHits = status.count === 0
  const label = statusLabel(status)
  const motion = !shown
    ? wantsOpen
      ? twMerge('opacity-0', isDesktop && 'scale-[0.96]')
      : 'opacity-0 duration-[var(--motion-overlay-out)] ease-in'
    : 'opacity-100 duration-[var(--motion-overlay-in)] ease-out'

  return (
    <div
      ref={nodeRef}
      role="search"
      aria-label="Find in document"
      data-testid="caret-find-bar"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        close()
      }}
      className={
        isDesktop
          ? twMerge(
              popoverPanelClassName,
              'caret-find-bar absolute top-2 right-[calc(var(--scrollbar-size-thin)+0.5rem)] flex w-[22rem] max-w-[calc(100%-1.5rem)] origin-top-right items-center gap-1 px-2 py-1.5',
              'motion-safe:transition-[opacity,scale]',
              motion
            )
          : twMerge(
              'caret-find-bar border-base-300 bg-base-100 flex w-full min-w-0 shrink-0 items-center gap-1 border-b px-3 py-1.5',
              'motion-safe:transition-opacity',
              motion
            )
      }>
      <TextInput
        ref={inputRef}
        ghost
        size="sm"
        aria-label="Find in document"
        placeholder="Find in document"
        data-testid="caret-find-input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          sendQuery(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
          event.preventDefault()
          step(event.shiftKey ? -1 : 1)
        }}
        startIcon={<Icons.search size={ICON_SIZE} className="text-base-content/50" />}
        wrapperClassName="min-w-0 flex-1"
        // iOS zooms the page on focus when an input's text is under 16px.
        className={isDesktop ? undefined : 'text-base'}
      />
      <span
        aria-hidden
        data-testid="caret-find-count"
        className="text-meta text-base-content/60 min-w-16 shrink-0 text-center tabular-nums">
        {label}
      </span>
      <FindCountAnnouncer label={label} />
      <ToolbarDivider />
      <ToolbarButton
        aria-label="Previous match"
        tooltip={isDesktop ? 'Previous match (⇧+Enter)' : undefined}
        disabled={noHits}
        onMouseDown={keepInputFocus}
        onPress={() => step(-1)}>
        <Icons.chevronUp size={ICON_SIZE} />
      </ToolbarButton>
      <ToolbarButton
        aria-label="Next match"
        tooltip={isDesktop ? 'Next match (Enter)' : undefined}
        disabled={noHits}
        onMouseDown={keepInputFocus}
        onPress={() => step(1)}>
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
