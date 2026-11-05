import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'

export function TocEmptyState() {
  return (
    <div className="px-4 pt-4 pb-6">
      <p className="text-base-content/60 text-sm">Add headings to build an outline.</p>
      <AppendHeadingButton className="mt-3" />
    </div>
  )
}
