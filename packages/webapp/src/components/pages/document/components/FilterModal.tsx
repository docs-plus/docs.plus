import { SheetLayout } from '@components/SheetLayout'
import { SheetPrimaryFooter } from '@components/SheetPrimaryFooter'
import TextInput from '@components/ui/TextInput'
import { Icons } from '@icons'
import { useSheetStore } from '@stores'
import { useRouter } from 'next/router'
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'

const FilterModal = () => {
  const filterSearchRef = useRef<HTMLInputElement>(null)
  const [totalHeading, setTotalHeading] = useState(0)
  const [totalSearch, setTotalSearch] = useState(0)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const { isSheetOpen } = useSheetStore((state) => state)

  const countHeadings = useCallback(() => {
    const headings = document.querySelectorAll('.title')
    setTotalHeading(headings.length)
    return headings
  }, [])

  useEffect(() => {
    if (search.length === 0) {
      setTotalSearch(0)
      return
    }
    const headings = countHeadings()
    const regex = new RegExp(search, 'i')
    const matched = Array.from(headings).filter((h) => regex.test(h.textContent || ''))
    setTotalSearch(matched.length)
  }, [search, countHeadings])

  const applySearch = useCallback(() => {
    const searchValue = filterSearchRef.current?.value
    const mainDoc = router.query.slugs?.[0]
    if (searchValue) window.location.href = `/${mainDoc}/${encodeURIComponent(searchValue)}`
  }, [router.query.slugs])

  const handleKeyUp = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      setSearch((e.target as HTMLInputElement).value)
      if (e.key === 'Enter') applySearch()
    },
    [applySearch]
  )

  useEffect(() => {
    if (isSheetOpen('filters')) countHeadings()
  }, [isSheetOpen, countHeadings])

  const applyDisabled = !search || totalSearch === 0 || totalSearch === totalHeading

  return (
    <SheetLayout
      title="Filters"
      footer={
        <SheetPrimaryFooter
          label="Apply filter"
          onClick={applySearch}
          disabled={applyDisabled}
          testId="filter-sheet-apply"
        />
      }>
      <div className="flex flex-col gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <TextInput
            id="filterModalBottom"
            startIcon={Icons.search}
            placeholder="Find in document..."
            onKeyUp={handleKeyUp}
            ref={filterSearchRef}
            className="flex-1"
          />
          <div className="bg-base-200 rounded-field flex shrink-0 flex-col items-center justify-center px-3 py-2">
            <span className="text-base-content text-xs font-semibold">{totalSearch}</span>
            <span className="text-base-content/60 text-[10px]">of {totalHeading}</span>
          </div>
        </div>
      </div>
    </SheetLayout>
  )
}

export default FilterModal
