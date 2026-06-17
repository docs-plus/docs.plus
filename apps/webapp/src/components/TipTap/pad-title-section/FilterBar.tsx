import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { REMOVE_FILTER, RESET_FILTER } from '@services/eventsHub'
import { useStore } from '@stores'
import PubSub from 'pubsub-js'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

type ChipType = 'child' | 'parent' | 'neutral'

interface SortedSlug {
  text: string
  existsInParent: boolean
  type: ChipType
}

const Chip = ({ type, text }: { type: ChipType; text: string }) => {
  const colorMap: Record<ChipType, string> = {
    child: 'text-base-content/70 bg-base-200 border-base-300',
    parent: 'text-info bg-info/10 border-info/30',
    neutral: 'text-error bg-error/10 border-error/30 cursor-not-allowed'
  }

  return (
    <span
      className={twMerge(
        'm-0.5 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs leading-none font-medium motion-safe:animate-[doc-region-in_180ms_ease-out_both]',
        colorMap[type]
      )}>
      <span className="truncate">{text}</span>
      <button
        type="button"
        onClick={() => PubSub.publish(REMOVE_FILTER, { slug: text })}
        aria-label={`Remove filter: ${text}`}
        className="-mr-1 inline-flex shrink-0 cursor-pointer rounded-full p-0.5 opacity-60 hover:opacity-100">
        <Icons.close size={12} />
      </button>
    </span>
  )
}

const FilterBar = ({
  className,
  displayRestButton = false
}: {
  className?: string
  displayRestButton?: boolean
}) => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)
  const sortedSlugs = useStore((state) => state.settings.editor.filterResult.sortedSlugs)
  const typedSortedSlugs = sortedSlugs as SortedSlug[]

  const resetFilterHandler = useCallback(() => {
    PubSub.publish(RESET_FILTER, {})
  }, [])

  return (
    <div
      className={twMerge(
        `group flex items-center ${typedSortedSlugs.length && isMobile && 'mt-2'}`,
        className
      )}>
      {typedSortedSlugs.map((slug) => (
        <Chip key={slug.text} text={slug.text} type={slug.existsInParent ? slug.type : 'neutral'} />
      ))}

      {displayRestButton && typedSortedSlugs.length > 0 && (
        <Button
          variant="ghost"
          size="xs"
          className="ml-2 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
          onClick={resetFilterHandler}
          startIcon={<Icons.filterX size={14} />}>
          Reset
        </Button>
      )}
    </div>
  )
}

export default FilterBar
