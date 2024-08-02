import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import {
  searchThroughHeading,
  applySearchThroughHeading,
  highlightTocHeadings
} from './toolbarUtils'
import Toggle from '@components/ui/Toggle'
import { useBooleanLocalStorageState } from './toolbarUtils'
import { MdOutlineKeyboardArrowDown } from 'react-icons/md'
import { useStore } from '@stores'
import FilterBar from '../pad-title-section/FilterBar'
import { TbFilter, TbFilterX, TbFilterCheck } from 'react-icons/tb'

const ToggleSection = ({ name, className, description, value, checked, onChange }: any) => {
  const containerClasses = twMerge('flex flex-col p-2 antialiased', className)

  return (
    <div className={containerClasses}>
      <p className="text-base font-bold">{name}</p>
      <div className="flex w-full flex-row items-center justify-between align-middle">
        <p className="text-sm text-gray-500">{description}</p>
        <div className="ml-2 mr-6 h-full flex-col border-l px-3 py-2">
          <Toggle id={value} checked={checked} onChange={onChange} />
        </div>
      </div>
    </div>
  )
}

const FilterModal = ({ totalHeading = 0, className = '' }) => {
  const router = useRouter()
  const { slugs } = router.query

  const [totalSearch, setTotalSearch] = useState(0)
  const [totalHeadings, setTotalHeadings] = useState(totalHeading)
  const [filterInput, setFilterInput] = useState('')
  const [filteredHeadings, setFilteredHeadings] = useState([])
  const [filterAlgorithm, setFilterAlgorithm] = useBooleanLocalStorageState(
    'setting.filterAlgorithm',
    false
  )
  const [isSectionOpen, setIsSectionOpen] = useState(false)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const {
    editor: {
      filterResult: { sortedSlugs, selectedNodes }
    }
  } = useStore((state) => state.settings)

  const datalist = useMemo(
    () => filteredHeadings.map((heading: any) => heading.textContent),
    [filteredHeadings]
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
        setWorkspaceEditorSetting('applyingFilters', true)
        applySearchThroughHeading(filterInput, router)
        clearForm()
      }
    },
    [filterInput, router]
  )

  const handleApplySearch = () => {
    setWorkspaceEditorSetting('applyingFilters', true)
    applySearchThroughHeading(filterInput, router)
    clearForm()
  }

  const handelFilterAlgorithm = () => {
    if (!slugs) return

    setFilterAlgorithm(!filterAlgorithm)
    if (slugs?.length > 1) {
      window.location.href = `${location.origin}/${router.asPath}`
    }
  }

  const clearForm = () => {
    setFilterInput('')
    setTotalSearch(0)
    setTotalHeadings(totalHeading)
    setFilteredHeadings([])
    highlightTocHeadings([])
  }

  const resetFilterHandler = () => {
    const url = new URL(window.location.href)
    const documentSlug = url.pathname.split('/').at(1)
    router.push(`/${documentSlug}`, undefined, { shallow: true })
    setWorkspaceEditorSetting('applyingFilters', true)
  }

  return (
    <div className={twMerge('gearModal text-neutral', className)}>
      <div className="flex items-center align-middle">
        <div>
          <p className="m-0 flex items-center space-x-1 font-semibold">
            <TbFilter size={18} fill="rgba(42,42,42)" />
            <span>Filter</span>
          </p>
          <small className="pl-2 text-gray-400">Search and filter headings sections</small>
        </div>
      </div>

      <div className="flex w-full flex-col justify-start py-2">
        <div className="join w-full">
          <label
            htmlFor="toggle-section"
            className="btn join-item btn-md h-[2.4rem] !min-h-[2.4rem] border border-gray-300 px-1">
            <MdOutlineKeyboardArrowDown size={24} />
          </label>
          <input
            type="text"
            id="filterSearchBox"
            className="input input-md join-item input-bordered h-[2.4rem] w-full"
            value={filterInput}
            onKeyUp={handleSearch}
            onChange={(e: any) => setFilterInput(e.target.value)}
            placeholder="Find in document"
            list={datalist.length > 0 ? 'filterSearchBox-datalist' : undefined}
          />

          {datalist.length > 0 && (
            <datalist id="filterSearchBox-datalist">
              {datalist.map((option: string, index: number) => (
                <option key={index} value={option} />
              ))}
            </datalist>
          )}
          <div className="flex items-center justify-center rounded-r-md border border-gray-300 px-3 text-sm font-semibold text-gray-500">
            {totalSearch}
          </div>
        </div>
      </div>

      <input
        type="checkbox"
        id="toggle-section"
        className="peer hidden"
        onChange={() => setIsSectionOpen(!isSectionOpen)}
      />
      <label htmlFor="toggle-section" className="cursor-pointer">
        <div
          className={`transition-max-height overflow-hidden duration-500 ease-in-out ${
            isSectionOpen ? 'max-h-40' : 'max-h-0'
          }`}>
          <ToggleSection
            className="rounded-md bg-base-200 px-2 py-1 shadow-inner"
            name="Filter Algorithm"
            description="Switch between relevant-only OR sequential heading filtering"
            checked={filterAlgorithm}
            onChange={handelFilterAlgorithm}
          />
        </div>
      </label>

      {sortedSlugs.length > 0 && (
        <div className="mb-3 mt-2 py-2">
          <div className="flex items-center text-sm">
            <p className="flex space-x-1 font-semibold">
              <TbFilterCheck size={16} fill="rgba(42,42,42)" />
              <span> Active filters</span>
            </p>
            <button className="btn btn-ghost btn-sm ml-auto text-xs" onClick={resetFilterHandler}>
              <TbFilterX size={16} fill="rgba(42,42,42)" />
              <span className="">Reset</span>
            </button>
          </div>
          <FilterBar className="flex-wrap" />
        </div>
      )}

      <div className="flex items-center pt-2">
        <button
          className="btn btn-sm w-3/12"
          onClick={() => {
            setFilterInput('')
            setTotalSearch(0)
            setTotalHeadings(totalHeading)
            setFilteredHeadings([])
            highlightTocHeadings([])
          }}>
          <span>Clear</span>
        </button>
        <button className="btn btn-neutral btn-sm ml-auto w-8/12" onClick={handleApplySearch}>
          <span>Apply</span>
        </button>
      </div>
    </div>
  )
}

export default FilterModal
