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

  const fetchDocuments = async ({ queryKey: [, page, search] }) => {
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
    }, 700),
    []
  )

  const handleSearch = (e) => {
    const { value } = e.target
    setInputValue(value)
    debouncedSearch(value)
  }

  const pages = Math.ceil(data?.total / itemsPerPage)

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < pages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <InputOverlapLabel
        label="Search Documents"
        className="mb-4 w-full rounded border px-3"
        value={inputValue}
        onChange={handleSearch}
      />
      {isError && <div className="flex h-96">Error: {error.message}</div>}
      {!isError && isLoading ? (
        <div className="flex h-96 items-center justify-around align-baseline">
          <Spinner />
          <span className="ml-2">Loading...</span>
        </div>
      ) : (!isError && data?.total) > 0 ? (
        <DocumentTable data={data} />
      ) : (
        <div className="flex h-96 items-center align-baseline">
          <span>No documents found</span>
        </div>
      )}

      {!isLoading && data?.total > 0 && pages > 1 && (
        <div className="mt-4 flex">
          {currentPage > 0 && (
            <button
              onClick={handlePrevPage}
              className="rounded border bg-blue-500 px-4 py-2 text-white hover:bg-blue-700">
              Prev
            </button>
          )}
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              className={`mx-1 rounded border px-4 py-2 ${
                i === currentPage ? 'bg-blue-500 text-white' : ''
              }`}
              onClick={() => setCurrentPage(i)}>
              {i + 1}
            </button>
          ))}
          {currentPage < pages - 1 && (
            <button
              onClick={handleNextPage}
              className="rounded border bg-blue-500 px-4 py-2 text-white hover:bg-blue-700">
              Next
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default DocumentsPanel
