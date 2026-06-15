import TableOfContentsLoader from '@components/skeleton/TableOfContentsLoader'
import { TocDesktop, TocHeader } from '@components/toc'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const TOC = ({ className = '' }: { className?: string }) => {
  const loading = useStore((state) => state.settings.editor.loading)
  const applyingFilters = useStore((state) => state.settings.editor.applyingFilters)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const editor = useStore((state) => state.settings.editor.instance)

  // Entry fade plays once — the loader branch remounts the real branch on every
  // filter apply and would replay it otherwise.
  const [entryFadeDone, setEntryFadeDone] = useState(false)

  if (loading || !editor || applyingFilters || providerSyncing) {
    return (
      <div className="p-4">
        <TableOfContentsLoader className="mt-2" />
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'tiptap__toc flex h-full min-h-0 w-full flex-col !pt-0',
        !entryFadeDone && 'motion-safe:animate-[doc-content-in_240ms_ease-out_both]',
        className
      )}
      onAnimationEnd={(e) => {
        if (e.animationName === 'doc-content-in') setEntryFadeDone(true)
      }}>
      <TocHeader variant="desktop" />
      <ScrollArea className="min-h-0 flex-1 !pt-0" scrollbarSize="thin" hideScrollbar>
        <TocDesktop className="hover:overscroll-contain" />
      </ScrollArea>
    </div>
  )
}

export default TOC
