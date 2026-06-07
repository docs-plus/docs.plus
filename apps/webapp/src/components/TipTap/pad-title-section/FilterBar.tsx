import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { REMOVE_FILTER, RESET_FILTER } from '@services/eventsHub'
import { useStore } from '@stores'
import PubSub from 'pubsub-js'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

type ChipType = 'child' | 'parent' | 'neutral'

interface ChipProps {
  type: ChipType
  text: string
  onMouseEnter: () => void
  onMouseLeave: () => void
}

interface FilterNode {
  filterBy?: string
  rootPath: {
    keys: () => Iterable<string>
  }
}

interface SortedSlug {
  text: string
  existsInParent: boolean
  type: ChipType
}

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

const Chip = ({ type, text, onMouseEnter, onMouseLeave }: ChipProps) => {
  const colorMap: Record<ChipType, string> = {
    child: 'text-base-content/70 bg-base-200 border-base-300',
    parent: 'text-info bg-info/10 border-info/30',
    neutral: 'text-error bg-error/10 border-error/30 cursor-not-allowed'
  }

  const removeFilterHandler = (slug: string) => {
    PubSub.publish(REMOVE_FILTER, { slug })
  }

  return (
    <div
      className={twMerge(
        `bg-base-100 m-1 flex cursor-pointer items-center justify-center rounded-md border px-2 py-1 font-medium`,
        colorMap[type]
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
  const isMobile = useStore((state) => state.settings.editor.isMobile)
  const sortedSlugs = useStore((state) => state.settings.editor.filterResult.sortedSlugs)
  const selectedNodes = useStore((state) => state.settings.editor.filterResult.selectedNodes)
  const typedSortedSlugs = sortedSlugs as SortedSlug[]
  const typedSelectedNodes = selectedNodes as FilterNode[]

  const highlightHeading = (slug: string) => {
    const matchingNodes = typedSelectedNodes.filter((node) => node.filterBy === slug)
    if (!matchingNodes.length) return
    const rootPath = new Set(matchingNodes.flatMap((node) => [...node.rootPath.keys()]))
    const headings = document.querySelectorAll(`.tiptap__toc .toc__list .toc__item`)
    headings.forEach((header) => {
      const id = header.getAttribute('data-id')
      const firstChildSpan = header.firstElementChild as HTMLSpanElement

      if (id && rootPath.has(id)) {
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
        `group flex items-center align-middle ${typedSortedSlugs.length && isMobile && 'mt-2'}`,
        className
      )}>
      {typedSortedSlugs.map((slug, index: number) => (
        <Chip
          key={index}
          text={slug.text}
          type={slug.existsInParent ? slug.type : 'neutral'}
          onMouseLeave={removeHeadingHighlight}
          onMouseEnter={() => highlightHeading(slug.text)}
        />
      ))}

      {displayRestButton && typedSortedSlugs.length > 0 && (
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
