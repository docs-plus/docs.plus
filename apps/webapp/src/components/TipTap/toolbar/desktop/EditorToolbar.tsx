import { BookmarkPanelSkeleton } from '@components/bookmarkPanel/components/BookmarkPanelSkeleton'
import { useSettingsModal } from '@components/settings/hooks/useSettingsModal'
import { SettingsTakeover } from '@components/settings/SettingsTakeover'
import ToolbarSkeleton from '@components/skeleton/ToolbarSkeleton'
import {
  Popover,
  PopoverContent,
  popoverPanelClassName,
  PopoverTrigger
} from '@components/ui/Popover'
import useReRenderOnEditorTransaction from '@hooks/useReRenderOnEditorTransaction'
import { Icons } from '@icons'
import useCopyDocumentToClipboard from '@pages/document/hooks/useCopyDocumentToClipboard'
import useTurnSelectedTextIntoComment from '@pages/document/hooks/useTurnSelectedTextIntoComment'
import {
  selectInProgressBookmarkCount,
  useAuthStore,
  useChatStore,
  useStore,
  withInProgressBookmarks
} from '@stores'
import dynamic from 'next/dynamic'
import React, { useEffect } from 'react'

import MediaInsertPanelSkeleton from '../../mediaPopovers/MediaInsertPanelSkeleton'
import { indicatorDotClassName } from '../indicatorDot'
import ToolbarButton from '../ToolbarButton'
import ToolbarDivider from '../ToolbarDivider'
import ToolbarSelect from '../ToolbarSelect'
import { DocumentSettingsSkeleton } from './DocumentSettingsSkeleton'
import { FilterSkeleton } from './FilterSkeleton'
import {
  documentSettingsOpenRequest,
  filterOpenRequest,
  insertMediaOpenRequest
} from './popoverOpenRequest'
import StyleSelect from './StyleSelect'

/* ── Lazy-loaded panels ── */

const MediaInsertPanel = dynamic(() => import('../../mediaPopovers/MediaInsertPanel'), {
  loading: () => <MediaInsertPanelSkeleton />
})

const DocumentSettingsPanel = dynamic(() => import('./DocumentSettingsPanel'), {
  loading: () => <DocumentSettingsSkeleton />
})

const BookmarkPanel = dynamic(
  () => import('@components/bookmarkPanel').then((m) => m.BookmarkPanel),
  { loading: () => <BookmarkPanelSkeleton /> }
)

const FilterPanel = dynamic(() => import('./FilterPanel'), {
  loading: () => <FilterSkeleton />
})

/* ── Constants ── */

const ICON_SIZE = 16

/* ── Component ── */

const EditorToolbar = () => {
  const editor = useStore((state) => state.settings.editor.instance)
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const isAuthServiceAvailable = useStore((state) => state.settings.isAuthServiceAvailable)
  const hasActiveFilters = useStore(
    (state) => state.settings.editor.filterResult.sortedSlugs.length > 0
  )
  const user = useAuthStore((state) => state.profile)
  const inProgressBookmarks = useChatStore(selectInProgressBookmarkCount)
  const { isOpen: isDocumentsOpen, setIsOpen: setDocumentsOpen } = useSettingsModal()

  useReRenderOnEditorTransaction(editor ?? null)

  const { createComment } = useTurnSelectedTextIntoComment()
  const { copyDocumentToClipboard, copied } = useCopyDocumentToClipboard(editor ?? null)
  const copyDocumentTooltip = copied ? 'Copied!' : 'Copy document'

  useEffect(() => {
    if (!editor) return

    const onKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey
      if (!isMod || !event.altKey) return
      if (event.key.toLowerCase() !== 'm') return

      event.preventDefault()
      createComment(editor)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor, createComment])

  if (loading || providerSyncing || !editor) return <ToolbarSkeleton />

  return (
    <>
      {/* Pad shell borders: PadTitle `border-b` (header↔toolbar); this row `border-b` only (toolbar↔workspace); sheet top edge is `.tiptap__editor` in _blocks.scss — do not add `border-t` here or you double the header seam. */}
      <div className="tiptap__toolbar border-base-300 bg-base-100 flex min-w-0 flex-row items-center justify-between gap-0.5 border-b px-3 py-1.5 sm:justify-start">
        <StyleSelect editor={editor} />

        <ToolbarDivider />

        {/* Text formatting */}

        <ToolbarButton
          editor={editor}
          type="bold"
          data-testid="toolbar-bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          tooltip="Bold (⌘+B)">
          <Icons.bold size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarButton
          editor={editor}
          type="italic"
          data-testid="toolbar-italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          tooltip="Italic (⌘+I)">
          <Icons.italic size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarButton
          editor={editor}
          type="underline"
          data-testid="toolbar-underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          tooltip="Underline (⌘+U)">
          <Icons.underline size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarButton
          editor={editor}
          type="strike"
          data-testid="toolbar-strike"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          tooltip="Strikethrough (⌘+⇧+S)">
          <Icons.strikethrough size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarButton
          editor={editor}
          type="highlight"
          data-testid="toolbar-highlight"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          tooltip="Highlight (⌘+⇧+H)">
          <Icons.highlight size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Rich content */}

        <Popover placement="bottom-start">
          <PopoverTrigger asChild>
            <ToolbarButton tooltip="Insert media">
              <Icons.image size={ICON_SIZE} />
            </ToolbarButton>
          </PopoverTrigger>
          <PopoverContent className={popoverPanelClassName}>
            <MediaInsertPanel />
          </PopoverContent>
          <insertMediaOpenRequest.Listener />
        </Popover>

        <ToolbarButton
          editor={editor}
          type="chatComment"
          data-testid="toolbar-comment"
          onClick={() => createComment(editor)}
          tooltip="Comment (⌘+⌥+M)">
          <Icons.comment size={ICON_SIZE} />
        </ToolbarButton>

        {/* No focus(): the click blurs the pad, so focus() would refocus it in a rAF and
            take the caret back from the URL field. scrollIntoView() keeps the scroll that focus() did. */}
        <ToolbarButton
          editor={editor}
          type="hyperlink"
          data-testid="toolbar-hyperlink"
          onClick={() => editor.chain().scrollIntoView().openCreateHyperlinkPopover().run()}
          tooltip="Hyperlink (⌘+K)">
          <Icons.link size={ICON_SIZE} />
        </ToolbarButton>

        {/* Lists dropdown */}

        <ToolbarDivider />

        <ToolbarSelect
          editor={editor}
          fallbackIcon={Icons.bulletList}
          tooltip="Lists"
          testId="toolbar-lists"
          items={[
            {
              value: 'bulletList',
              label: 'Bullet list',
              icon: Icons.bulletList,
              action: () => editor.chain().focus().toggleBulletList().run(),
              testId: 'toolbar-bullet-list'
            },
            {
              value: 'orderedList',
              label: 'Ordered list',
              icon: Icons.orderedList,
              action: () => editor.chain().focus().toggleOrderedList().run(),
              testId: 'toolbar-ordered-list'
            },
            {
              value: 'taskList',
              label: 'Task list',
              icon: Icons.taskList,
              action: () => editor.chain().focus().toggleTaskList().run(),
              testId: 'toolbar-task-list'
            }
          ]}
        />

        {/* Blockquote */}

        <ToolbarButton
          editor={editor}
          type="blockquote"
          data-testid="toolbar-blockquote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          tooltip="Blockquote">
          <Icons.blockquote size={ICON_SIZE} />
        </ToolbarButton>

        {/* Code dropdown */}

        <ToolbarSelect
          editor={editor}
          fallbackIcon={Icons.code}
          tooltip="Code"
          testId="toolbar-code"
          items={[
            {
              value: 'codeBlock',
              label: 'Code block',
              icon: Icons.codeBlock,
              action: () => editor.chain().focus().toggleCodeBlock().run(),
              testId: 'toolbar-code-block'
            },
            {
              value: 'inlineCode',
              label: 'Inline code',
              icon: Icons.code,
              action: () => editor.chain().focus().toggleInlineCode().run(),
              testId: 'toolbar-inline-code'
            }
          ]}
        />

        <ToolbarDivider />

        <ToolbarButton
          data-testid="toolbar-clear-formatting"
          disabled={!editor.can().clearFormatting()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().clearFormatting().run()}
          tooltip={'Clear formatting (⌘+\\)'}>
          <Icons.clearFormatting size={ICON_SIZE} />
        </ToolbarButton>

        {/* Right-side actions */}

        <div className="!ml-auto flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => window.open('https://discord.gg/2EmAjmgZ8', '_blank')}
            tooltip="Join Discord community">
            <Icons.discord size={ICON_SIZE} className="text-[#5865F2]" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton onClick={copyDocumentToClipboard} tooltip={copyDocumentTooltip}>
            <span className={`swap ${copied ? 'swap-active' : ''}`} aria-hidden>
              <Icons.check size={ICON_SIZE} className="swap-on text-success stroke-[1.75]" />
              <Icons.copy size={ICON_SIZE} className="swap-off stroke-[1.75]" />
            </span>
          </ToolbarButton>

          {isAuthServiceAvailable && user && (
            <ToolbarButton onClick={() => setDocumentsOpen(true)} tooltip="Documents">
              <Icons.documents size={ICON_SIZE} />
            </ToolbarButton>
          )}

          {user && <ToolbarDivider />}

          {user && (
            <Popover placement="bottom-end">
              <PopoverTrigger asChild>
                <ToolbarButton
                  tooltip="Bookmarks"
                  aria-label={withInProgressBookmarks('Bookmarks', inProgressBookmarks)}
                  className="relative">
                  <Icons.bookmark size={ICON_SIZE} />
                  {inProgressBookmarks > 0 && (
                    <span
                      data-testid="bookmarks-in-progress-indicator"
                      className={indicatorDotClassName('ring-base-100')}
                      aria-hidden
                    />
                  )}
                </ToolbarButton>
              </PopoverTrigger>
              <PopoverContent className={popoverPanelClassName}>
                <BookmarkPanel />
              </PopoverContent>
            </Popover>
          )}

          <Popover placement="bottom-end">
            <PopoverTrigger asChild>
              <ToolbarButton
                tooltip={hasActiveFilters ? 'Filter document (active)' : 'Filter document'}
                aria-label="Filter document"
                className="relative">
                <Icons.filter size={ICON_SIZE} />
                {hasActiveFilters && (
                  <span
                    data-testid="filter-active-indicator"
                    className={indicatorDotClassName('ring-base-100')}
                    aria-hidden
                  />
                )}
              </ToolbarButton>
            </PopoverTrigger>
            <PopoverContent className={popoverPanelClassName}>
              <FilterPanel />
            </PopoverContent>
            <filterOpenRequest.Listener />
          </Popover>

          <ToolbarDivider />

          <Popover placement="bottom-end">
            <PopoverTrigger asChild>
              <ToolbarButton tooltip="Document settings" tooltipPlacement="left">
                <Icons.settings size={ICON_SIZE} />
              </ToolbarButton>
            </PopoverTrigger>
            <PopoverContent className={popoverPanelClassName}>
              <DocumentSettingsPanel />
            </PopoverContent>
            <documentSettingsOpenRequest.Listener />
          </Popover>
        </div>
      </div>

      <SettingsTakeover
        open={isDocumentsOpen}
        onOpenChange={setDocumentsOpen}
        defaultTab="documents"
      />
    </>
  )
}

export default React.memo(EditorToolbar)
