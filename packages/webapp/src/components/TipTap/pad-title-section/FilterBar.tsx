import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { REMOVE_FILTER, RESET_FILTER } from '@services/eventsHub'
import { useStore } from '@stores'
import PubSub from 'pubsub-js'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    onClick={onClick}
    variant="ghost"
    size="xs"
    shape="circle"
    className="text-base-content/50 hover:text-base-content ml-1.5"
    aria-label="Remove filter"
    startIcon={<Icons.close size={14} />}
  />
)

const Chip = ({ type, text, onMouseEnter, onMouseLeave }: any) => {
  const colorMap = {
    child: 'text-base-content/70 bg-base-200 border-base-300',
    parent: 'text-info bg-info/10 border-info/30',
    neutral: 'text-error bg-error/10 border-error/30 cursor-not-allowed'
  }

  const removeFilterHandler = (slug: any) => {
    PubSub.publish(REMOVE_FILTER, { slug })
  }

  return (
    <div
      className={twMerge(
        `bg-base-100 m-1 flex cursor-pointer items-center justify-center rounded-md border px-2 py-1 font-medium`,
        colorMap[type as keyof typeof colorMap]
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}>
      <div className="max-w-full flex-initial text-xs leading-none font-normal">{text}</div>
      <div className="flex flex-auto flex-row-reverse">
        <CloseButton onClick={() => removeFilterHandler(text)} />
      </div>
    </div>
  )
}

const FilterBar = ({
  className,
  displayRestButton = false
}: {
  className?: string
  displayRestButton?: boolean
}) => {
  const {
    editor: {
      isMobile,
      filterResult: { sortedSlugs, selectedNodes }
    }
  } = useStore((state) => state.settings)

  if (!sortedSlugs) return null

  const highlightHeading = (slug: string) => {
    const matchingNodes = selectedNodes.filter((node: any) => node.filterBy === slug)
    if (!matchingNodes.length) return
    const rootPath = new Set(matchingNodes.flatMap((n: any) => [...n.rootPath.keys()]))
    const headings = document.querySelectorAll(`.tiptap__toc .toc__list .toc__item`)
    headings.forEach((header) => {
      const id = header.getAttribute('data-id')
      const firstChildSpan = header.firstElementChild as HTMLSpanElement

      if (rootPath.has(id)) {
        firstChildSpan?.classList.add('bg-yellow-100')
      } else {
        firstChildSpan.classList.remove('bg-yellow-100')
      }
    })
  }

  const removeHeadingHighlight = () => {
    const headings = document.querySelectorAll(`.tiptap__toc .toc__list .toc__item`)
    headings.forEach((header) => header.firstElementChild?.classList.remove('bg-yellow-100'))
  }

  const resetFilterHandler = useCallback(() => {
    PubSub.publish(RESET_FILTER, {})
  }, [])

  return (
    <div
      className={twMerge(
        `group flex items-center align-middle ${sortedSlugs.length && isMobile && 'mt-2'}`,
        className
      )}>
      {sortedSlugs.map((slug: any, index: number) => (
        <Chip
          key={index}
          text={slug.text}
          type={slug.existsInParent ? slug.type : 'neutral'}
          onMouseLeave={removeHeadingHighlight}
          onMouseEnter={() => highlightHeading(slug.text)}
        />
      ))}

      {displayRestButton && sortedSlugs.length > 0 && (
        <Button
          variant="ghost"
          size="xs"
          className="ml-3 text-xs font-medium opacity-0 transition-all group-hover:opacity-100"
          onClick={resetFilterHandler}
          startIcon={<Icons.filterX size={14} />}>
          Reset
        </Button>
      )}
    </div>
  )
}

export default FilterBar
