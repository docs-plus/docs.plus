import React, { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import _ from 'lodash'
import DocumentTable from '../../DocumentTable'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import { AngleSmallLeft, Spinner } from '@icons'
import TabTitle from '../components/TabTitle'
import TabSection from '../components/TabSection'

const useWindowWidth = () => {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = _.debounce(() => {
      setWidth(window.innerWidth)
    }, 200)

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return width
}

const getVisibleButtonCount = (width: number) => {
  if (width < 380) return 1
  if (width < 480) return 2
  if (width < 640) return 3
  if (width < 768) return 4
  return 5
}

const DocumentsPanel = ({ goBack }: any) => {
  const [currentPage, setCurrentPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [inputValue, setInputValue] = useState('')

  const itemsPerPage = 9

  const fetchDocuments = async ({ queryKey: [_, page, search] }: any) => {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents?limit=${itemsPerPage}&offset=${
        page * itemsPerPage
      }${search ? '&title=' + search : ''}`
    )
    return response.data.data
  }

  const { isLoading, isError, data, error } = useQuery(
    ['documents', currentPage, searchQuery],
    fetchDocuments
  )

  const debouncedSearch = useCallback(
    _.debounce((value) => {
      setSearchQuery(value)
      setCurrentPage(0)
    }, 700),
    []
  )

  const handleSearch = (e: any) => {
    const { value } = e.target
    setInputValue(value)
    debouncedSearch(value)
  }

  const pages = Math.ceil(data?.total / itemsPerPage)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const windowWidth = useWindowWidth()
  const visibleButtons = getVisibleButtonCount(windowWidth)

  const renderPaginationButtons = () => {
    const buttons = []
    const ellipsis = (
      <button key="ellipsis" className="btn btn-disabled join-item btn-sm">
        ...
      </button>
    )

    if (pages <= visibleButtons) {
      for (let i = 0; i < pages; i++) {
        buttons.push(
          <button
            key={i}
            className={`btn join-item btn-sm ${i === currentPage ? 'btn-active' : ''}`}
            onClick={() => handlePageChange(i)}>
            {i + 1}
          </button>
        )
      }
    } else {
      const halfVisible = Math.floor(visibleButtons / 2)
      const leftBound = Math.min(Math.max(currentPage - halfVisible, 0), pages - visibleButtons)
      const rightBound = Math.min(leftBound + visibleButtons - 1, pages - 1)

      // Always show first page if not in visible range
      if (leftBound > 0) {
        buttons.push(
          <button key={0} className="btn join-item btn-sm" onClick={() => handlePageChange(0)}>
            1
          </button>
        )
        if (leftBound > 1) buttons.push(ellipsis)
      }

      // Show visible range
      for (let i = leftBound; i <= rightBound; i++) {
        buttons.push(
          <button
            key={i}
            className={`btn join-item btn-sm ${i === currentPage ? 'btn-active' : ''}`}
            onClick={() => handlePageChange(i)}>
            {i + 1}
          </button>
        )
      }

      // Always show last page if not in visible range
      if (rightBound < pages - 1) {
        if (rightBound < pages - 2) buttons.push(ellipsis)
        buttons.push(
          <button
            key={pages - 1}
            className="btn join-item btn-sm"
            onClick={() => handlePageChange(pages - 1)}>
            {pages}
          </button>
        )
      }
    }

    return buttons
  }

  return (
    <div className="relative h-full w-full md:border-l">
      <TabTitle className="flex" title="Documents" goBack={goBack} />

      <TabSection>
        <div className="card-body p-0">
          <div className="form-control mb-4 w-full">
            <InputOverlapLabel
              label="Search Documents"
              className="input input-bordered w-full"
              value={inputValue}
              onChange={handleSearch}
            />
          </div>
          {!isError && isLoading ? (
            <div className="flex size-96 items-center justify-center">
              <Spinner className="mr-2" />
              <span>Loading...</span>
            </div>
          ) : (!isError && data?.total) > 0 ? (
            <div className="overflow-x-auto">
              <DocumentTable data={data} />
            </div>
          ) : (
            <div className="alert shadow-md">No documents found</div>
          )}

          {!isLoading && data?.total > 0 && pages > 1 && (
            <div className="join mt-4 flex flex-wrap justify-center gap-1">
              <button
                className="btn join-item btn-sm"
                onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}>
                «
              </button>
              {renderPaginationButtons()}
              <button
                className="btn join-item btn-sm"
                onClick={() => handlePageChange(Math.min(pages - 1, currentPage + 1))}
                disabled={currentPage === pages - 1}>
                »
              </button>
            </div>
          )}
        </div>
      </TabSection>
    </div>
  )
}

export default DocumentsPanel
