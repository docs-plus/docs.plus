import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import { twMerge } from 'tailwind-merge'

type TocEmptyStateProps = {
  className?: string
}

/** Shared empty outline copy for desktop pad TOC and mobile TocModal. */
export function TocEmptyState({ className }: TocEmptyStateProps) {
  return (
    <div className={twMerge('px-4 pt-4 pb-6', className)}>
      <p className="text-base-content/60 text-sm">Add headings to build an outline.</p>
      <AppendHeadingButton className="mt-3" />
    </div>
  )
}
