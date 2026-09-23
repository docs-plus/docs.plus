import SignInSheet from '@components/auth/SignInSheet'
import { BookmarkPanel } from '@components/bookmarkPanel'
import MessageReactionSheet from '@components/pages/document/components/chat/MessageReactionSheet'
import HistoryCompareSheet from '@components/pages/history/mobile/HistoryCompareSheet'
import DocumentSettingsPanel from '@components/TipTap/toolbar/desktop/DocumentSettingsPanel'
import FilterPanel from '@components/TipTap/toolbar/desktop/FilterPanel'
import {
  FloatingFocusManager,
  useDismiss,
  useFloating,
  useInteractions,
  useRole
} from '@floating-ui/react'
import { useHistoryDismiss } from '@hooks/useHistoryDismiss'
import { type SheetData, type SheetDataMap, sheetTransitionHandlers, useSheetStore } from '@stores'
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { Sheet, SheetProps } from 'react-modal-sheet'

import { NotificationPanel } from './notificationPanel/desktop/NotificationPanel'
import LinkEditorSheet from './TipTap/hyperlinkPopovers/LinkEditorSheet'
import LinkPreviewSheet from './TipTap/hyperlinkPopovers/LinkPreviewSheet'
import MediaControlsSheet from './TipTap/mediaPopovers/MediaControlsSheet'
import MediaInsertSheet from './TipTap/mediaPopovers/MediaInsertSheet'
import SlashMenuSheet from './TipTap/slash/SlashMenuSheet'

type SheetEntry<K extends keyof SheetDataMap> = {
  render: (data: SheetDataMap[K]) => React.ReactNode
} & (
  | { trapFocus?: true; ariaLabel: string }
  | {
      /** Leaves focus where it is, so the phone keyboard stays up. The sheet is not a dialog then. */
      trapFocus: false
      ariaLabel?: never
    }
) &
  Partial<SheetProps>

const SHEETS: { [K in keyof SheetDataMap]: SheetEntry<K> } = {
  notifications: {
    id: 'notification_sheet',
    ariaLabel: 'Notifications',
    detent: 'default',
    render: () => <NotificationPanel variant="sheet" />
  },
  filters: {
    id: 'filter_sheet',
    ariaLabel: 'Filter',
    detent: 'content',
    snapPoints: [0, 0.5, 1],
    render: () => <FilterPanel variant="sheet" />
  },
  bookmarks: {
    id: 'bookmark_sheet',
    ariaLabel: 'Bookmarks',
    detent: 'default',
    render: () => <BookmarkPanel variant="sheet" />
  },
  documentSettings: {
    id: 'document_settings_sheet',
    ariaLabel: 'Document settings',
    detent: 'default',
    render: () => <DocumentSettingsPanel variant="sheet" />
  },
  linkPreview: {
    id: 'link_preview_sheet',
    ariaLabel: 'Link',
    detent: 'content',
    render: (data) => <LinkPreviewSheet data={data} />
  },
  linkEditor: {
    id: 'link_editor_sheet',
    detent: 'content',
    trapFocus: false,
    render: (data) => <LinkEditorSheet data={data} />
  },
  mediaControls: {
    id: 'media_controls_sheet',
    ariaLabel: 'Media layout',
    detent: 'content',
    render: (data) => <MediaControlsSheet data={data} />
  },
  mediaInsert: {
    id: 'media_insert_sheet',
    ariaLabel: 'Insert media',
    detent: 'content',
    render: (data) => <MediaInsertSheet data={data} />
  },
  slashMenu: {
    id: 'slash_menu_sheet',
    detent: 'content',
    // The query is typed in the editor, so focus must stay there.
    trapFocus: false,
    render: (data) => <SlashMenuSheet data={data} />
  },
  historyCompare: {
    id: 'history_compare_sheet',
    ariaLabel: 'Compare with',
    detent: 'default',
    render: () => <HistoryCompareSheet />
  },
  messageReaction: {
    id: 'message_reaction_sheet',
    ariaLabel: 'React',
    detent: 'content',
    render: () => <MessageReactionSheet />
  },
  signIn: {
    id: 'sign_in_sheet',
    ariaLabel: 'Sign in',
    detent: 'content',
    render: (data) => <SignInSheet data={data} />
  }
}

const DEFAULT_SHEET_PROPS: Partial<SheetProps> = { id: 'bottom_sheet' }

const BottomSheet = () => {
  const { activeSheet, closeSheet, sheetData } = useSheetStore()
  const isOpen = !!activeSheet
  const activeEntry = isOpen ? SHEETS[activeSheet] : null
  const trapFocus = !!activeEntry && activeEntry.trapFocus !== false
  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) closeSheet()
    }
  })
  const { getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePress: false, enabled: trapFocus }),
    useRole(context, { role: 'dialog', enabled: trapFocus })
  ])
  const openerRef = useRef<HTMLElement | null>(null)

  // Focus at open is often the editor, not the tapped control: iOS never focuses a tapped button,
  // and dismissSoftKeyboard blurs 50ms late. Return only to a tabbable, non-text opener, so close
  // never raises the keyboard or lands on `#pad-main`'s first link. Null returns focus to nothing.
  useLayoutEffect(() => {
    if (!isOpen) return
    const active = document.activeElement
    openerRef.current =
      active instanceof HTMLElement &&
      active.tabIndex >= 0 &&
      !active.isContentEditable &&
      !active.closest('.ProseMirror, input, textarea')
        ? active
        : null
  }, [isOpen])

  // The sheet root stays `visibility: hidden` until its open tween moves it, so focus waits for the end.
  const focusSheet = useCallback(() => {
    const container = refs.floating.current
    if (trapFocus && container && !container.contains(document.activeElement)) {
      container.focus({ preventScroll: true })
    }
  }, [refs, trapFocus])

  // The backdrop is a `<button>`, so a tap focuses it outside the sheet, and the focus manager then
  // skips its return. Pull focus back inside first, so a backdrop dismiss returns like Close does.
  const closeFromBackdrop = useCallback(() => {
    if (trapFocus) refs.floating.current?.focus({ preventScroll: true })
    closeSheet()
  }, [refs, trapFocus, closeSheet])

  // Every dismiss path (X, scrim, drag) already routes through closeSheet, whether
  // called here or from inside sheet content — see useHistoryDismiss.
  useHistoryDismiss(isOpen, closeSheet)

  const content = useMemo((): React.ReactNode => {
    if (!activeSheet) return null
    const renderer = SHEETS[activeSheet].render as (data: SheetData) => React.ReactNode
    return renderer(sheetData)
  }, [activeSheet, sheetData])

  const sheetProps = useMemo<Partial<SheetProps>>(() => {
    if (!activeSheet) return DEFAULT_SHEET_PROPS
    const {
      render: _render,
      trapFocus: _trapFocus,
      ariaLabel: _ariaLabel,
      ...props
    } = SHEETS[activeSheet]
    return props
  }, [activeSheet])

  return (
    <Sheet
      avoidKeyboard
      className="bottom-sheet !z-50"
      isOpen={isOpen}
      onClose={closeSheet}
      {...sheetProps}
      {...sheetTransitionHandlers}
      onOpenEnd={focusSheet}>
      {/* Guards set aria-hidden on the page, never inert: inert recreates media node views. */}
      <FloatingFocusManager
        context={context}
        disabled={!trapFocus}
        initialFocus={-1}
        returnFocus={openerRef}>
        <Sheet.Container
          ref={refs.setFloating}
          {...getFloatingProps()}
          aria-modal={trapFocus || undefined}
          aria-label={activeEntry?.ariaLabel}
          tabIndex={-1}
          className="outline-none">
          {/* Empty Header mounts the library DragIndicator. Do not add a house grabber. */}
          <Sheet.Header />
          <Sheet.Content disableScroll>{content}</Sheet.Content>
        </Sheet.Container>
      </FloatingFocusManager>
      <Sheet.Backdrop onTap={closeFromBackdrop} />
    </Sheet>
  )
}

export default BottomSheet
