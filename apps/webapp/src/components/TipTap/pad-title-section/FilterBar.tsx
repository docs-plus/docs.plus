import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { REMOVE_FILTER, RESET_FILTER } from '@services/eventsHub'
import { useStore } from '@stores'
import PubSub from 'pubsub-js'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

const Chip = ({ text }: { text: string }) => (
  <span className="border-info/30 bg-info/10 rounded-field m-0.5 inline-flex max-w-full items-center gap-0.5 border py-0.5 pr-0.5 pl-2 text-xs leading-none font-medium text-[var(--info-ink)] motion-safe:animate-[doc-region-in_180ms_ease-out_both]">
    <span className="truncate">{text}</span>
    <button
      type="button"
      onClick={() => PubSub.publish(REMOVE_FILTER, { slug: text })}
      aria-label={`Remove filter: ${text}`}
      className="inline-flex size-11 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full opacity-70 hover:opacity-100">
      <Icons.close size={14} />
    </button>
  </span>
)

const FilterBar = ({
  className,
  displayRestButton = false
}: {
  className?: string
  displayRestButton?: boolean
}) => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)
  const sortedSlugs = useStore((state) => state.settings.editor.filterResult.sortedSlugs)

  const resetFilterHandler = useCallback(() => {
    PubSub.publish(RESET_FILTER, {})
  }, [])

  if (sortedSlugs.length === 0) return null

  return (
    <div className={twMerge('group flex items-center', isMobile && 'mt-2', className)}>
      {sortedSlugs.map((slug) => (
        <Chip key={slug.text} text={slug.text} />
      ))}

      {displayRestButton && (
        <Button
          variant="ghost"
          size="xs"
          className={twMerge(
            'ml-2 text-xs font-medium',
            isMobile ? 'opacity-100' : 'opacity-0 transition-opacity group-hover:opacity-100'
          )}
          onClick={resetFilterHandler}
          startIcon={<Icons.filterX size={14} />}>
          Reset
        </Button>
      )}
    </div>
  )
}

export default FilterBar
