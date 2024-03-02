import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import { twMerge } from 'tailwind-merge'
import {
  searchThroughHeading,
  applySearchThroughHeading,
  highlightTocHeadings
} from './toolbarUtils'
import Button from '@components/ui/Button'
import Toggle from '@components/ui/Toggle'
import { useBooleanLocalStorageState } from './toolbarUtils'

const FilterModal = ({ totalHeading = 0, className = '' }) => {
  const router = useRouter()
  const [totalSearch, setTotalSearch] = useState(0)
  const [totalHeadings, setTotalHeadings] = useState(totalHeading)
  const [filterInput, setFilterInput] = useState('')
  const [filteredHeadings, setFilteredHeadings] = useState([])
  const [filterAlgorithm, setFilterAlgorithm] = useBooleanLocalStorageState(
    'setting.filterAlgorithm',
    false
  )

  useEffect(() => {
    if (totalHeading !== totalSearch && totalSearch > 0) {
      highlightTocHeadings(filteredHeadings)
    } else {
      highlightTocHeadings([])
    }
  }, [totalSearch])

  const handleSearch = useCallback(
    (e: any) => {
      const { totalSearch, totalHeadings, filteredHeadings } = searchThroughHeading(e) as any
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

  const handelFilterAlgorithm = () => {
    if (!router.query.slugs) return

    setFilterAlgorithm(!filterAlgorithm)
    if (router.query.slugs?.length > 1) {
      window.location.href = `${location.origin}/${router.asPath}`
    }
  }

  const ToggleSection = ({ name, className, description, value, checked, onChange }: any) => {
    const containerClasses = twMerge(`flex flex-col p-2 antialiased `, className)

    return (
      <div className={containerClasses}>
        <p className="text-base font-bold">{name}</p>
        <div className="flex w-full flex-row align-middle justify-between items-center">
          <p className="text-gray-500 text-sm">{description}</p>
          <div className="border-l flex-col h-full py-2 px-3 ml-2 mr-6">
            <Toggle id={value} checked={checked} onChange={onChange} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={twMerge(' gearModal text-neutral', className)}>
      <div className="flex align-middle items-center">
        <p className="font-medium  pb-1">Filter:</p>
      </div>
      <hr />
      <div className="content pt-2 mt-4 flex align-middle justify-between pb-2 border-b">
        <InputOverlapLabel
          className="h-10"
          id="filterSearchBox"
          label="Find in document"
          value={filterInput}
          onKeyUp={handleSearch}
          datalist={filteredHeadings.map((heading: any) => heading.textContent)}
          onChange={(e: any) => setFilterInput(e.target.value)}
        />
        <p className="mx-2 text-xs  text-center">
          Found <b>{totalSearch}</b> matches out of <b>{totalHeadings}</b> headings
        </p>
      </div>
      <ToggleSection
        name="Filter Algorithm"
        description="Switch between relevant-only OR sequential heading filtering"
        checked={filterAlgorithm}
        onChange={handelFilterAlgorithm}
      />
      <Button onClick={handleApplySearch} className="btn-primary btn-sm mt-6 btn-block text-white">
        <span>Apply</span>
      </Button>
    </div>
  )
}

export default FilterModal
