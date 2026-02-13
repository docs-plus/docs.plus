import SheetHeader from '@components/SheetHeader'
import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import { useSheetStore } from '@stores'
import { useRouter } from 'next/router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LuSearch } from 'react-icons/lu'

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
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      setSearch((e.target as HTMLInputElement).value)
      if (e.key === 'Enter') applySearch()
    },
    [applySearch]
  )

  useEffect(() => {
    if (isSheetOpen('filters')) countHeadings()
  }, [isSheetOpen, countHeadings])

  return (
    <div className="bg-base-100 h-full max-h-96 w-full rounded-t-2xl p-4 pt-0">
      <SheetHeader title="Filters" />

      {/* Search Input */}
      <div className="flex items-center gap-2">
        <TextInput
          id="filterModalBottom"
          startIcon={LuSearch}
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

      {/* Apply Button */}
      <div className="mt-6">
        <Button
          variant="primary"
          shape="block"
          onTouchStart={applySearch}
          onClick={applySearch}
          disabled={
            !search || search.length === 0 || totalSearch === 0 || totalSearch === totalHeading
          }>
          Apply Filter
        </Button>
      </div>
    </div>
  )
}

export default FilterModal
