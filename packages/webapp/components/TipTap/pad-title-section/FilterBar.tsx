import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import { Close as CloseIcon } from '@icons'
import { useStore } from '@stores'

const CloseButton = ({ onClick }: any) => (
  <button onClick={onClick}>
    <CloseIcon className="feather feather-x ml-2 size-4 cursor-pointer rounded-full hover:text-indigo-400" />
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
        `m-1 flex cursor-pointer items-center justify-center rounded-md border bg-white px-2 py-1 font-medium`,
        colorMap[type as keyof typeof colorMap]
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}>
      <div className="max-w-full flex-initial text-xs font-normal leading-none">{text}</div>
      <div className="flex flex-auto flex-row-reverse">
        <CloseButton onClick={() => removeFilter(text)} />
      </div>
    </div>
  )
}

const FilterBar = () => {
  const {
    editor: {
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

  return (
    <div className="flex items-center align-middle">
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
