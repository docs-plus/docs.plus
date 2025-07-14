import React, { useState, useEffect, useRef, RefObject } from 'react'
import { useRouter } from 'next/router'
import { IoClose } from 'react-icons/io5'
const FilterModalHeader = ({
  setIsFilterModalOpen
}: {
  setIsFilterModalOpen: (isOpen: boolean) => void
}) => {
  return (
    <>
      <div className="flex w-full items-center justify-center">
        <span className="drag-indicator h-1 w-14 rounded-full bg-gray-300"></span>
      </div>
      <div className="mb-3 flex w-full bg-white py-2 text-black">
        <p className="w-2/3 text-lg font-semibold">Filters</p>
        <div className="flex w-1/3 flex-row items-center justify-end justify-items-end">
          <label
            htmlFor="filterModalBottom"
            className="btn btn-square btn-ghost btn-sm ml-2 text-black"
            onClick={() => setIsFilterModalOpen(false)}>
            <IoClose size={20} />
          </label>
        </div>
      </div>
    </>
  )
}

const FilterModal = ({
  setIsFilterModalOpen
}: {
  setIsFilterModalOpen: (isOpen: boolean) => void
}) => {
  const filterSearchRef = useRef<HTMLInputElement>(null)
  const [totalHeading, setTotalHeading] = useState(0)
  const [totalSearch, setTotalSearch] = useState(0)
  const [search, setSearch] = useState('')
  const router = useRouter()

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

  const handleModalStateChange = (isOpen: boolean) => {
    if (!isOpen) setSearch('')
    else countHeadings()
  }

  return (
    <div className="h-full max-h-96 w-full rounded-t-lg bg-white p-4">
      <FilterModalHeader setIsFilterModalOpen={setIsFilterModalOpen} />
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
