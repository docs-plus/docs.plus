import TableOfContentsLoader from '@components/skeleton/TableOfContentsLoader'
import { TocDesktop } from '@components/toc'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { useState } from 'react'

const TOC = ({ className = '' }: { className?: string }) => {
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const editor = useStore((state) => state.settings.editor.instance)

  const showLoader = loading || !editor || providerSyncing

  // The entry fade is for a mount with the outline ready, such as a return from history.
  // After the bones, the outline swaps in with no fade. The flag also stops a replay.
  const [fadeIn, setFadeIn] = useState(!showLoader)

  if (showLoader) {
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
        fadeIn && 'motion-safe:animate-[doc-content-in_200ms_ease-out_both]',
        className
      )}
      onAnimationEnd={(e) => {
        if (e.animationName === 'doc-content-in') setFadeIn(false)
      }}>
      <ScrollArea
        // Column-width scroller: the scrollbar stays inside the TOC wrapper (a widened
        // scroller pushed it out over the editor). Reserve a stable gutter so the
        // hover scrollbar never sits under the right-anchored presence stack.
        className="toc__scroll min-h-0 flex-1 !pt-0"
        scrollbarSize="thin"
        hideScrollbar
        preserveWidth={true}
        fade="end">
        <TocDesktop className="w-full hover:overscroll-contain" />
      </ScrollArea>
    </div>
  )
}

export default TOC
