import {
  clampTocWidth,
  readPersistedTocWidth,
  resolveTocContainerWidth,
  TOC_DEFAULT_WIDTH
} from '@components/pages/document/hooks/useTocResize'
import EditorContentSkeleton from '@components/skeleton/EditorContentSkeleton'
import TableOfContentsLoader from '@components/skeleton/TableOfContentsLoader'
import ToolbarSkeleton from '@components/skeleton/ToolbarSkeleton'
import { DocsPlusIcon } from '@icons'
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

// A CSS gate keeps the pill hidden for 1.5s from the first SSR paint, because JS timers
// cannot run before hydration, which is the slow window. `step-end` makes it appear with
// no fade, like `Loading`, so it needs no motion-safe: gate.
const StatusPill = () => (
  <div
    role="status"
    className="surface-inverse-raised fixed bottom-4 left-4 z-50 flex animate-[doc-content-in_1500ms_step-end_both] items-center gap-2 rounded-full px-4 py-2 text-sm shadow-xl">
    <span className="loading loading-spinner loading-sm" />
    <span>Opening document…</span>
  </div>
)

// Carries the real ancestor classes (`pad` → `editor` → `editorWrapper`) so `_blocks.scss`
// paints the bones EXACTLY as in-layout. Cohesion comes by cascade, not from a
// hand-mirrored utility copy that can drift. Header rows are h-14 (56px); the bones
// className matches DesktopEditor's EditorContent call verbatim.
const DesktopSkeleton = ({ tocWidth, isAuthed }: { tocWidth: number; isAuthed: boolean }) => (
  <div className="pad tiptap flex min-h-0 w-full flex-1 flex-col">
    <header className="border-base-300 bg-base-100 flex h-14 w-full shrink-0 items-center border-b px-3">
      <div className="flex flex-1 items-center gap-2">
        <div className="shrink-0">
          <DocsPlusIcon size={34} />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {/* DocTitle's box: a 1px border and px-1 around a text-lg line. */}
          <div className="border border-transparent px-1">
            <div className="flex h-7 items-center">
              <div className="skeleton h-5 w-40" />
            </div>
          </div>
          {/* The pre-sync Connecting chip of ProviderSyncStatus. */}
          <div className="flex items-center gap-1.5 px-3 py-1">
            <div className="skeleton size-[18px] rounded-full" />
            <div className="flex h-5 items-center">
              <div className="skeleton h-3.5 w-[71px]" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="skeleton rounded-field h-10 w-[97px]" />
        <div className="skeleton size-10 rounded-full" />
        <div className="skeleton size-10 rounded-full" />
        {isAuthed ? (
          <div className="skeleton size-12 rounded-full" />
        ) : (
          <div className="skeleton rounded-field h-10 w-20" />
        )}
      </div>
    </header>

    {/* DesktopEditor's toolbars wrapper: below 640px the bar sits at the bottom. */}
    <div className="toolbars bg-base-100 border-base-300 fixed bottom-0 z-[9] h-auto w-full border-t sm:relative sm:block sm:border-t-0">
      <ToolbarSkeleton isSignedIn={isAuthed} hasQr />
    </div>

    <div className="editor flex min-h-0 w-full flex-1 flex-row-reverse bg-[var(--pad-well)]">
      <div className="editorWrapper scrollbar-custom flex h-full min-w-0 flex-1 scrollbar-thin items-start justify-center overflow-y-auto scroll-smooth border-t-0 bg-[var(--pad-well)] px-3 py-4 sm:px-6 sm:py-6">
        <EditorContentSkeleton className="mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8" />
      </div>
      {/* The TOC sash idle hairline: 1px at the split, inside the editor column (ResizeHandle). */}
      <aside
        className="relative h-full shrink-0 bg-[var(--pad-well)] after:absolute after:inset-y-0 after:left-full after:w-px after:bg-[var(--resize-sash-idle)] after:content-['']"
        style={{ width: tocWidth }}>
        <TableOfContentsLoader />
      </aside>
    </div>
  </div>
)

// Mirrors MobilePadTitle's header (min-h-12 py-2 border-b), where the bones set the row
// height. It also mirrors the m_mobile `.editor.editorWrapper` padding (12px 0 20px 16px),
// the 16px `--tiptap-inline-pad-end` of _mobile.scss and the `.mobileLayoutRoot` safe-area
// side insets.
const MobileSkeleton = ({ isAuthed }: { isAuthed: boolean }) => (
  <div className="flex min-h-0 flex-1 flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
    <header className="bg-base-100 w-full shrink-0">
      <div className="border-base-300 flex min-h-12 w-full flex-col border-b px-2 py-2">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <div className="skeleton rounded-field size-8" />
            <div className="flex h-7 items-center">
              <div className="skeleton h-5 w-40" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isAuthed ? (
              <>
                <div className="skeleton rounded-field size-8" />
                <div className="skeleton size-10 rounded-full" />
              </>
            ) : (
              <div className="skeleton rounded-field h-8 w-16" />
            )}
          </div>
        </div>
      </div>
    </header>

    <div className="min-h-0 flex-1 overflow-hidden pt-3 pr-0 pb-5 pl-4">
      <EditorContentSkeleton className="pr-4" />
    </div>

    <div className="skeleton fixed right-6 bottom-[calc(2rem+env(safe-area-inset-bottom,0px))] z-20 size-16 rounded-full" />
  </div>
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
    <div className="bg-base-100 flex h-dvh w-full flex-col overflow-hidden">
      <div aria-hidden="true" className="flex h-full min-h-0 flex-1 flex-col">
        {isMobile ? (
          <MobileSkeleton isAuthed={isAuthed} />
        ) : (
          <DesktopSkeleton tocWidth={tocWidth} isAuthed={isAuthed} />
        )}
      </div>
      <StatusPill />
    </div>
  )
}
