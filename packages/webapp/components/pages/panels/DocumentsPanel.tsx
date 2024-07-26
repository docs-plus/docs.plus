// TODO: need to refactor!
import React, { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import _ from 'lodash'
import DocumentTable from './DocumentTable'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import { Spinner } from '@icons'

const DocumentsPanel = () => {
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

  const renderPaginationButtons = () => {
    const buttons = []
    const totalButtons = 6
    const ellipsis = (
      <button key="ellipsis" className="btn btn-disabled join-item btn-sm">
        ...
      </button>
    )

    if (pages <= totalButtons) {
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
      const leftBound = Math.min(Math.max(currentPage - 2, 0), pages - totalButtons + 1)
      const rightBound = Math.min(leftBound + totalButtons - 1, pages - 1)

      if (leftBound > 0) {
        buttons.push(
          <button key={0} className="btn join-item btn-sm" onClick={() => handlePageChange(0)}>
            1
          </button>
        )
        if (leftBound > 1) buttons.push(ellipsis)
      }

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
    <div className="card w-full bg-base-100">
      <div className="card-body p-0">
        <h2 className="card-title mb-4">Documents</h2>
        <div className="form-control mb-4 w-full">
          <InputOverlapLabel
            label="Search Documents"
            className="input input-bordered w-full"
            value={inputValue}
            onChange={handleSearch}
          />
        </div>
        {!isError && isLoading ? (
          <div className="flex h-96 items-center justify-center">
            <Spinner className="mr-2" />
            <span>Loading...</span>
          </div>
        ) : (!isError && data?.total) > 0 ? (
          <DocumentTable data={data} />
        ) : (
          <div className="alert m-4 shadow-md">No documents found</div>
        )}

        {!isLoading && data?.total > 0 && pages > 1 && (
          <div className="join mt-4 flex justify-center">
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
    </div>
  )
}

export default DocumentsPanel
