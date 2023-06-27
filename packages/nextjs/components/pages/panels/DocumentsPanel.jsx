import React, { useState, useEffect, useCallback } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import Image from 'next/image'
import _ from 'lodash'
import DocumentTable from './DocumentTable'
import InputOverlapLabel from '@components/InputOverlapLabel'
import { Spinner } from '@icons'

const DocumentsPanel = () => {
  const [currentPage, setCurrentPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [inputValue, setInputValue] = useState('')

  const itemsPerPage = 9

  const fetchDocuments = async ({ queryKey: [, page, search] }) => {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents?limit=${itemsPerPage}&offset=${page * itemsPerPage}${
        search ? '&title=' + search : ''
      }`
    )
    return response.data.data
  }

  const { isLoading, isError, data, error } = useQuery(['documents', currentPage, searchQuery], fetchDocuments)

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
    <div className="flex flex-col items-center justify-center w-full">
      <InputOverlapLabel
        label="Search Documents"
        className="w-full px-3 border rounded mb-4"
        value={inputValue}
        onChange={handleSearch}
      />
      {isError && <div className="flex h-96">Error: {error.message}</div>}
      {!isError && isLoading ? (
        <div className="flex h-96 align-baseline items-center justify-around">
          <Spinner />
          <span className="ml-2">Loading...</span>
        </div>
      ) : (!isError && data?.total) > 0 ? (
        <DocumentTable data={data} />
      ) : (
        <div className="flex h-96 align-baseline items-center">
          <span>No documents found</span>
        </div>
      )}

      {!isLoading && data?.total > 0 && pages > 1 && (
        <div className="flex mt-4">
          {currentPage > 0 && (
            <button
              onClick={handlePrevPage}
              className="px-4 py-2 border rounded text-white bg-blue-500 hover:bg-blue-700">
              Prev
            </button>
          )}
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              className={`mx-1 px-4 py-2 border rounded ${i === currentPage ? 'bg-blue-500 text-white' : ''}`}
              onClick={() => setCurrentPage(i)}>
              {i + 1}
            </button>
          ))}
          {currentPage < pages - 1 && (
            <button
              onClick={handleNextPage}
              className="px-4 py-2 border rounded text-white bg-blue-500 hover:bg-blue-700">
              Next
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default DocumentsPanel
