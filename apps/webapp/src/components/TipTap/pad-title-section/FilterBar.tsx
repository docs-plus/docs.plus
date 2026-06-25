import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { REMOVE_FILTER, RESET_FILTER } from '@services/eventsHub'
import { useStore } from '@stores'
import PubSub from 'pubsub-js'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

const Chip = ({ text }: { text: string }) => (
  <span className="border-info/30 bg-info/10 text-info m-0.5 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs leading-none font-medium motion-safe:animate-[doc-region-in_180ms_ease-out_both]">
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
