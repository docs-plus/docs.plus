import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { searchThroughHeading, applySerchThroughHeading } from './toolbarUtils'
import InputOverlapLabel from '../../InputOverlapLabel'

const FilterModal = ({ totalHeading }) => {
  const router = useRouter()
  const [totalSearch, setTotalSearch] = useState(0)
  const [totalHeadings, setTotalHeadings] = useState(totalHeading)
  const [filterInput, setFilterInput] = useState('')

  const handleSearch = useCallback(
    (e) => {
      const { totalSearch, totalHeadings } = searchThroughHeading(e)
      setTotalHeadings(totalHeadings)
      setTotalSearch(totalSearch)
      if (e.key === 'Enter') {
        applySerchThroughHeading(filterInput, router)
      }
    },
    [filterInput, router]
  )

  return (
    <div className="filterModal nd_modal">
      <div className="flex align-middle items-center">
        <p className="font-medium text-base text-gray-400 pb-1">Filter:</p>
        <button
          onClick={() => applySerchThroughHeading(filterInput, router)}
          className="!p-3 !w-24 !ml-auto  border">
          <span>Apply</span>
        </button>
      </div>

      <hr />
      <div className="content pt-2 flex align-middle justify-between">
        <InputOverlapLabel
          className="h-10 "
          id="filterSearchBox"
          label="Find in document"
          value={filterInput}
          onKeyUp={handleSearch}
          onChange={(e) => setFilterInput(e.target.value)}
        />
        <p className="mx-2 text-xs text-center">
          Found <b>{totalSearch}</b> matches out of <b>{totalHeadings}</b> headings
        </p>
      </div>
    </div>
  )
}

export default FilterModal
