import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import { Close as CloseIcon } from '@icons'
import { useStore } from '@stores'

const CloseButton = ({ onClick }: any) => (
  <button onClick={onClick}>
    <CloseIcon className="feather feather-x cursor-pointer hover:text-indigo-400 rounded-full w-4 h-4 ml-2" />
  </button>
)

const Chip = ({ type, text, onMouseEnter, onMouseLeave }: any) => {
  const router = useRouter()
  const { slugs } = router.query
  const colorMap = {
    child: 'text-gray-700 bg-gray-100 border-gray-300',
    parent: 'text-blue-700 bg-blue-100 border-blue-300',
    neutral: 'text-red-700 bg-red-100 border-red-300 cursor-not-allowed'
  }

  const removeFilter = (slug: any) => {
    const newSlug = Array.isArray(slugs) ? slugs.filter((s) => s !== slug).join('/') : ''
    const newPath = `/${location.pathname.split('/').at(1)}/${newSlug}`
    window.location.href = newPath
  }

  return (
    <div
      className={twMerge(
        `flex justify-center items-center m-1 font-medium py-1 px-2 bg-white rounded-md border cursor-pointer`,
        colorMap[type as keyof typeof colorMap]
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}>
      <div className="text-xs font-normal leading-none max-w-full flex-initial">{text}</div>
      <div className="flex flex-auto flex-row-reverse">
        <CloseButton onClick={() => removeFilter(text)} />
      </div>
    </div>
  )
}

const FilterBar = () => {
  const {
    editor: { filterResult }
  } = useStore((state) => state.settings)

  const { sortedSlugs, selectedNodes } = filterResult

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

  return (
    <div className="flex align-middle items-center">
      {sortedSlugs.map((slug: any, index: number) => (
        <Chip
          key={index}
          text={slug.text}
          type={slug.existsInParent ? slug.type : 'neutral'}
          onMouseLeave={removeHeadingHighlight}
          onMouseEnter={() => highlightHeading(slug.text)}
        />
      ))}
    </div>
  )
}

export default FilterBar
