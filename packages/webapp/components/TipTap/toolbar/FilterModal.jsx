import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import { searchThroughHeading, applySearchThroughHeading, highlightTocHeadings } from './toolbarUtils'

const FilterModal = ({ totalHeading }) => {
  const router = useRouter()
  const [totalSearch, setTotalSearch] = useState(0)
  const [totalHeadings, setTotalHeadings] = useState(totalHeading)
  const [filterInput, setFilterInput] = useState('')
  const [filteredHeadings, setFilteredHeadings] = useState([])

  useEffect(() => {
    if (totalHeading !== totalSearch && totalSearch > 0) {
      highlightTocHeadings(filteredHeadings)
    } else {
      highlightTocHeadings([])
    }
  }, [totalSearch])

  const handleSearch = useCallback(
    (e) => {
      const { totalSearch, totalHeadings, filteredHeadings } = searchThroughHeading(e)
      setFilteredHeadings(filteredHeadings)
      setTotalHeadings(totalHeadings)
      setTotalSearch(totalSearch)

      if (e.key === 'Enter') {
        applySearchThroughHeading(filterInput, router)
      }
    },
    [filterInput, router]
  )

  const handleApplySearch = () => {
    applySearchThroughHeading(filterInput, router)
  }

  return (
    <div className="filterModal nd_modal">
      <div className="flex align-middle items-center">
        <p className="font-medium text-base text-gray-400 pb-1">Filter:</p>
        <button onClick={handleApplySearch} className="p-3 w-24 ml-auto border">
          <span>Apply</span>
        </button>
      </div>
      <hr />
      <div className="content pt-2 flex align-middle justify-between">
        <InputOverlapLabel
          className="h-10"
          id="filterSearchBox"
          label="Find in document"
          value={filterInput}
          onKeyUp={handleSearch}
          datalist={filteredHeadings.map((heading) => heading.textContent)}
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
