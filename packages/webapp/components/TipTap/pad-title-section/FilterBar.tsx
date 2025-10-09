import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import { useStore } from '@stores'
import { IoCloseSharp } from 'react-icons/io5'
import { TbFilterX } from 'react-icons/tb'
import PubSub from 'pubsub-js'
import { RESET_FILTER, REMOVE_FILTER } from '@services/eventsHub'

const CloseButton = ({ onClick }: any) => (
  <button onClick={onClick}>
    <IoCloseSharp
      size={14}
      className="feather feather-x ml-2 cursor-pointer rounded-full hover:text-indigo-400"
    />
  </button>
)

const Chip = ({ type, text, onMouseEnter, onMouseLeave }: any) => {
  const colorMap = {
    child: 'text-gray-700 bg-gray-100 border-gray-300',
    parent: 'text-blue-700 bg-blue-100 border-blue-300',
    neutral: 'text-red-700 bg-red-100 border-red-300 cursor-not-allowed'
  }

  const removeFilterHandler = (slug: any) => {
    PubSub.publish(REMOVE_FILTER, { slug })
  }

  return (
    <div
      className={twMerge(
        `m-1 flex cursor-pointer items-center justify-center rounded-md border bg-white px-2 py-1 font-medium`,
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
        <button
          className="btn btn-ghost btn-xs ml-3 text-xs font-medium opacity-0 transition-all group-hover:opacity-100"
          onClick={resetFilterHandler}>
          <TbFilterX size={14} fill="rgba(42,42,42)" />
          <span className="">Reset</span>
        </button>
      )}
    </div>
  )
}

export default FilterBar
