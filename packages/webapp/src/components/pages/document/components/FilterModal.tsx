import React, { useState, useEffect, useRef, RefObject } from 'react'
import { useRouter } from 'next/router'
import { useSheetStore } from '@stores'
import SheetHeader from '@components/SheetHeader'

const FilterModal = () => {
  const filterSearchRef = useRef<HTMLInputElement>(null)
  const [totalHeading, setTotalHeading] = useState(0)
  const [totalSearch, setTotalSearch] = useState(0)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const { isSheetOpen } = useSheetStore((state) => state)

  const countHeadings = () => {
    const headings = document.querySelectorAll('.title')
    setTotalHeading(headings.length)
    return headings
  }

  useEffect(() => {
    if (search.length === 0) {
      setTotalSearch(0)
      return
    }
    const headings = countHeadings()

    const filterHeadings = (headings: any) => {
      const regex = new RegExp(search, 'i')
      const filteredHeadings = Array.from(headings).filter((heading: any) =>
        regex.test(heading.textContent)
      )
      setTotalSearch(filteredHeadings.length)
    }

    filterHeadings(headings)
  }, [search])

  const searchThroughHeading = (e: any) => {
    setSearch(e.target.value)

    if (e.key === 'Enter') applySearch()
  }

  const applySearch = () => {
    const search = filterSearchRef.current?.value
    const mainDoc = router.query.slugs?.[0] // Add nullish coalescing operator
    if (search) window.location.href = `/${mainDoc}/${encodeURIComponent(search)}`
  }

  useEffect(() => {
    if (isSheetOpen('filters')) countHeadings()
  }, [isSheetOpen])

  return (
    <div className="h-full max-h-96 w-full rounded-t-lg bg-white p-4 pt-0">
      <SheetHeader title="Filters" />
      <div className="join w-full">
        <input
          id="filterModalBottom"
          className="input join-item input-bordered w-9/12"
          type="text"
          inputMode="text"
          enterKeyHint="search"
          placeholder="Find"
          onKeyUp={searchThroughHeading}
          ref={filterSearchRef}
        />
        <p className="join-item bg-base-300 flex w-3/12 items-center justify-center rounded-r text-sm">
          <span className="text-center">
            found <br /> {totalSearch} of {totalHeading}
          </span>
        </p>
      </div>
      <div className="mt-8">
        <button
          onTouchStart={applySearch}
          onClick={applySearch}
          disabled={
            !search || search.length === 0 || totalSearch === 0 || totalSearch === totalHeading
          }
          className="btn btn-neutral btn-block">
          Filter Contents
        </button>
      </div>
    </div>
  )
}

export default FilterModal
