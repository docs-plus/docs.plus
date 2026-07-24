import TableOfContentsLoader from '@components/skeleton/TableOfContentsLoader'
import { TocDesktop } from '@components/toc'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const TOC = ({ className = '' }: { className?: string }) => {
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const editor = useStore((state) => state.settings.editor.instance)

  // Entry fade plays once on mount; the flag keeps it from replaying on re-render.
  const [entryFadeDone, setEntryFadeDone] = useState(false)

  if (loading || !editor || providerSyncing) {
    return (
      <div className="tiptap__toc flex h-full min-h-0 w-full flex-col !pt-0">
        <TableOfContentsLoader />
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'tiptap__toc flex h-full min-h-0 w-full flex-col !pt-0',
        !entryFadeDone && 'motion-safe:animate-[doc-content-in_200ms_ease-out_both]',
        className
      )}
      onAnimationEnd={(e) => {
        if (e.animationName === 'doc-content-in') setEntryFadeDone(true)
      }}>
      <ScrollArea
        // Column-width scroller: the scrollbar stays inside the TOC wrapper (a widened
        // scroller pushed it out over the editor). Reserve a stable gutter so the
        // hover scrollbar never sits under the right-anchored presence stack.
        className="toc__scroll min-h-0 flex-1 !pt-0"
        scrollbarSize="thin"
        hideScrollbar
        preserveWidth={true}>
        <TocDesktop className="w-full hover:overscroll-contain" />
      </ScrollArea>
    </div>
  )
}

export default TOC
