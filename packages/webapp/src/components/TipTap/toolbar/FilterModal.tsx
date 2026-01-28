import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import {
  searchThroughHeading,
  applySearchThroughHeading,
  highlightTocHeadings
} from './toolbarUtils'
import Toggle from '@components/ui/Toggle'
import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import CloseButton from '@components/ui/CloseButton'
import { useBooleanLocalStorageState } from './toolbarUtils'
import { LuChevronDown, LuSearch, LuX, LuFilterX, LuCheck } from 'react-icons/lu'
import { useStore } from '@stores'
import FilterBar from '../pad-title-section/FilterBar'
import PubSub from 'pubsub-js'
import { RESET_FILTER } from '@services/eventsHub'
import { usePopoverState } from '@components/ui/Popover'

interface ToggleSectionProps {
  name: string
  className?: string
  description: string
  value?: string
  checked: boolean
  onChange: () => void
}

const ToggleSection = ({
  name,
  className,
  description,
  value,
  checked,
  onChange
}: ToggleSectionProps) => {
  return (
    <div className={twMerge('flex items-center justify-between gap-4 py-3', className)}>
      <div className="min-w-0 flex-1">
        <p className="text-base-content text-sm font-medium">{name}</p>
        <p className="text-base-content/50 text-xs">{description}</p>
      </div>
      <Toggle
        id={value}
        checked={checked}
        onChange={() => onChange()}
        size="sm"
        variant="primary"
      />
    </div>
  )
}

interface FilterModalProps {
  totalHeading?: number
  className?: string
  onClose?: () => void
}

const FilterModal = ({ totalHeading = 0, className = '', onClose }: FilterModalProps) => {
  const popoverState = usePopoverState()
  const handleClose = onClose || popoverState.close
  const router = useRouter()
  const { slugs } = router.query

  const [totalSearch, setTotalSearch] = useState(0)
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
      filterResult: { sortedSlugs }
    }
  } = useStore((state) => state.settings)

  const datalist = useMemo(
    () => filteredHeadings.map((heading: any) => heading.textContent),
    [filteredHeadings]
  )

  const clearForm = useCallback(() => {
    setFilterInput('')
    setTotalSearch(0)
    setFilteredHeadings([])
    highlightTocHeadings([])
  }, [])

  useEffect(() => {
    if (totalHeading !== totalSearch && totalSearch > 0) {
      highlightTocHeadings(filteredHeadings)
    } else {
      highlightTocHeadings([])
    }
  }, [totalSearch, totalHeading, filteredHeadings])

  const handleSearch = useCallback(
    (e: any) => {
      const { totalSearch: newTotalSearch, filteredHeadings: newFilteredHeadings } =
        searchThroughHeading(e) as any
      setFilteredHeadings(newFilteredHeadings)
      setTotalSearch(newTotalSearch)

      if (e.key === 'Enter') {
        setWorkspaceEditorSetting('applyingFilters', true)
        applySearchThroughHeading(filterInput, router)
        clearForm()
      }
    },
    [filterInput, router, setWorkspaceEditorSetting, clearForm]
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

  const resetFilterHandler = useCallback(() => {
    PubSub.publish(RESET_FILTER, {})
  }, [])

  const handleClearAll = () => {
    clearForm()
    resetFilterHandler()
  }

  return (
    <div className={twMerge('bg-base-100 flex w-full flex-col', className)}>
      {/* Header */}
      <div className="border-base-300 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base-content text-lg font-semibold">Filter</h2>
          <CloseButton onClick={handleClose} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 p-4">
        {/* Search Input with integrated counter */}
        <div className="relative">
          <TextInput
            id="filterSearchBox"
            startIcon={LuSearch}
            value={filterInput}
            onKeyUp={handleSearch}
            onChange={(e) => setFilterInput(e.target.value.trim())}
            placeholder="Find in document..."
            datalist={datalist}
            className="pr-24"
          />
          {/* Counter badge inside input */}
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5">
            <span
              className={twMerge(
                'badge badge-md font-medium',
                totalSearch > 0 ? 'badge-primary badge-outline' : 'text-base-content/50'
              )}>
              {totalSearch}
            </span>
            <Button
              variant="ghost"
              size="xs"
              shape="square"
              className="text-base-content/50"
              onClick={() => setIsSectionOpen(!isSectionOpen)}
              aria-label="Toggle options">
              <LuChevronDown
                size={16}
                className={`transition-transform duration-200 ${isSectionOpen ? 'rotate-180' : ''}`}
              />
            </Button>
          </div>
        </div>

        {/* Advanced Options (collapsible) */}
        {isSectionOpen && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="rounded-box border-base-300 bg-base-200 border px-4">
              <ToggleSection
                name="Filter Algorithm"
                description="Use sequential heading order instead of relevance"
                checked={filterAlgorithm}
                onChange={handelFilterAlgorithm}
              />
            </div>
          </div>
        )}

        {/* Active Filters */}
        {sortedSlugs.length > 0 && (
          <div className="rounded-box border-base-300 bg-base-100 border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LuCheck className="text-success size-4" />
                <span className="text-base-content text-sm font-medium">Active Filters</span>
              </div>
              <Button
                variant="ghost"
                size="xs"
                className="text-base-content/50 hover:text-error gap-1"
                onClick={resetFilterHandler}
                startIcon={LuFilterX}>
                Reset
              </Button>
            </div>
            <FilterBar className="flex-wrap" />
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-base-300 bg-base-200/50 flex items-center gap-3 border-t px-4 py-3">
        <Button
          variant="neutral"
          btnStyle="outline"
          className="flex-1"
          disabled={sortedSlugs.length === 0 && !filterInput}
          onClick={handleClearAll}
          startIcon={LuX}>
          Clear
        </Button>
        <Button
          variant="primary"
          className="flex-[2]"
          onClick={handleApplySearch}
          disabled={!filterInput}>
          Apply Filter
        </Button>
      </div>
    </div>
  )
}

export default FilterModal
