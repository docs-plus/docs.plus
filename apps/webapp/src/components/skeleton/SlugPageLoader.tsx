import {
  clampTocWidth,
  readPersistedTocWidth,
  resolveTocContainerWidth,
  TOC_DEFAULT_WIDTH
} from '@components/pages/document/hooks/useTocResize'
import EditorContentSkeleton from '@components/skeleton/EditorContentSkeleton'
import TableOfContentsLoader from '@components/skeleton/TableOfContentsLoader'
import ToolbarSkeleton from '@components/skeleton/ToolbarSkeleton'
import { useEffect, useState } from 'react'

// SSR renders the 320px default; the post-hydration settle to the user's persisted
// width is an accepted sub-100ms shift during the chunk-load phase.
const usePersistedTocWidth = () => {
  const [tocWidth, setTocWidth] = useState(TOC_DEFAULT_WIDTH)

  useEffect(() => {
    const sync = () => {
      setTocWidth(clampTocWidth(readPersistedTocWidth(), resolveTocContainerWidth(null)))
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  return tocWidth
}

// CSS animation-delay (fill-mode both) keeps the pill invisible for 1.5s from first
// SSR paint — JS timers can't run until hydration, which IS the slow window. The
// delay is functional (anti-flash), so no motion-safe: gate; _entry.scss strips the
// translate under prefers-reduced-motion instead.
const StatusPill = () => (
  <div
    role="status"
    className="bg-neutral text-neutral-content fixed bottom-4 left-4 z-50 flex animate-[doc-region-in_200ms_ease-out_1500ms_both] items-center gap-2 rounded-full px-4 py-2 text-sm shadow-lg">
    <span className="loading loading-spinner loading-sm" />
    <span>Opening document…</span>
  </div>
)

// Carries the real ancestor classes (`pad` → `editor` → `editorWrapper`) so the
// `_blocks.scss` sheet rules paint the bones EXACTLY as in-layout — cohesion by
// cascade, not by a hand-mirrored utility copy that can drift. Header rows are
// h-14 (56px) with the anon/authed control sizes; bones className matches
// DesktopEditor's EditorContent call verbatim.
const DesktopSkeleton = ({ tocWidth, isAuthed }: { tocWidth: number; isAuthed: boolean }) => (
  <div className="pad tiptap flex min-h-0 w-full flex-1 flex-col">
    <header className="border-base-300 bg-base-100 flex h-14 min-h-12 w-full items-center border-b px-3 py-2">
      <div className="flex flex-1 items-center gap-2">
        <div className="skeleton size-[34px] rounded" />
        <div className="skeleton h-5 w-40 rounded" />
        <div className="skeleton h-5 w-14 rounded" />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="skeleton rounded-field h-10 w-20" />
        {isAuthed ? (
          <>
            <div className="skeleton size-10 rounded-full" />
            <div className="skeleton size-10 rounded-full" />
            <div className="skeleton size-12 rounded-full" />
          </>
        ) : (
          <div className="skeleton rounded-field h-10 w-20" />
        )}
      </div>
    </header>

    <ToolbarSkeleton />

    <div className="editor flex min-h-0 w-full flex-1 flex-row-reverse bg-[var(--pad-well)]">
      <div className="editorWrapper scrollbar-custom scrollbar-thin flex h-full min-w-0 flex-1 items-start justify-center overflow-y-auto scroll-smooth border-t-0 bg-[var(--pad-well)] px-3 py-4 sm:px-6 sm:py-6">
        <EditorContentSkeleton className="mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8" />
      </div>
      <aside className="h-full shrink-0 bg-[var(--pad-well)]" style={{ width: tocWidth }}>
        <TableOfContentsLoader />
      </aside>
    </div>
  </div>
)

// Geometry mirrors MobilePadTitle's sticky header (56px — size-10 controls) and
// the m_mobile `.editor.editorWrapper` padding (12px 0 20px 16px).
const MobileSkeleton = () => (
  <>
    <header className="bg-base-100 w-full shrink-0">
      <div className="border-base-300 flex h-14 min-h-12 w-full flex-col justify-center border-b px-2 py-2">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <div className="skeleton size-9 rounded" />
            <div className="skeleton ml-1 h-6 w-40 rounded" />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="skeleton size-10 rounded-full" />
            <div className="skeleton size-10 rounded-full" />
          </div>
        </div>
      </div>
    </header>

    <div className="min-h-0 flex-1 overflow-hidden pt-3 pr-4 pb-5 pl-4">
      <EditorContentSkeleton />
    </div>

    <div className="skeleton fixed right-6 bottom-8 z-20 size-16 rounded-full" />
  </>
)

export const SlugPageLoader = ({
  isMobile = false,
  isAuthed = false
}: {
  isMobile?: boolean
  isAuthed?: boolean
}) => {
  const tocWidth = usePersistedTocWidth()

  return (
    <div className="bg-base-200 flex h-dvh w-full flex-col overflow-hidden">
      <div aria-hidden="true" className="flex h-full min-h-0 flex-1 flex-col">
        {isMobile ? (
          <MobileSkeleton />
        ) : (
          <DesktopSkeleton tocWidth={tocWidth} isAuthed={isAuthed} />
        )}
      </div>
      <StatusPill />
    </div>
  )
}
