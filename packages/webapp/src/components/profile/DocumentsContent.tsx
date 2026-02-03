import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { debounce } from 'lodash'
import { useCallback, useState } from 'react'
import { LuChevronLeft, LuChevronRight, LuFileText, LuSearch } from 'react-icons/lu'

interface DocumentsContentProps {
  onBack?: () => void
}

const ITEMS_PER_PAGE = 9

const DocumentsContent = ({ onBack: _onBack }: DocumentsContentProps) => {
  const [currentPage, setCurrentPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [inputValue, setInputValue] = useState('')

  const fetchDocuments = async ({ queryKey }: { queryKey: (string | number)[] }) => {
    const [, page, search] = queryKey
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents?limit=${ITEMS_PER_PAGE}&offset=${
        Number(page) * ITEMS_PER_PAGE
      }${search ? '&title=' + search : ''}`
    )
    return response.data.data
  }

  const { isLoading, isError, data } = useQuery(
    ['documents', currentPage, searchQuery],
    fetchDocuments
  )

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchQuery(value)
      setCurrentPage(0)
    }, 700),
    []
  )

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    setInputValue(value)
    debouncedSearch(value)
  }

  const handleDocumentClick = (slug: string) => {
    window.location.assign(`/${slug}`)
  }

  const totalPages = Math.ceil((data?.total || 0) / ITEMS_PER_PAGE)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Generate pagination buttons
  const renderPaginationButtons = () => {
    const buttons = []
    const maxVisible = 5
    const half = Math.floor(maxVisible / 2)

    let start = Math.max(0, currentPage - half)
    let end = Math.min(totalPages - 1, start + maxVisible - 1)

    if (end - start + 1 < maxVisible) {
      start = Math.max(0, end - maxVisible + 1)
    }

    // First page + ellipsis
    if (start > 0) {
      buttons.push(
        <Button key={0} size="sm" className="join-item" onClick={() => handlePageChange(0)}>
          1
        </Button>
      )
      if (start > 1) {
        buttons.push(
          <Button key="start-ellipsis" size="sm" className="join-item" disabled>
            ...
          </Button>
        )
      }
    }

    // Visible range
    for (let i = start; i <= end; i++) {
      buttons.push(
        <Button
          key={i}
          size="sm"
          variant={i === currentPage ? 'primary' : undefined}
          className="join-item"
          onClick={() => handlePageChange(i)}>
          {i + 1}
        </Button>
      )
    }

    // Ellipsis + last page
    if (end < totalPages - 1) {
      if (end < totalPages - 2) {
        buttons.push(
          <Button key="end-ellipsis" size="sm" className="join-item" disabled>
            ...
          </Button>
        )
      }
      buttons.push(
        <Button
          key={totalPages - 1}
          size="sm"
          className="join-item"
          onClick={() => handlePageChange(totalPages - 1)}>
          {totalPages}
        </Button>
      )
    }

    return buttons
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <section className="bg-base-100 border-base-300 rounded-box border p-4 sm:p-6">
        <TextInput
          labelPosition="floating"
          startIcon={LuSearch}
          placeholder="Search by title..."
          value={inputValue}
          onChange={handleSearch}
        />
      </section>

      {/* Documents Table */}
      <section className="bg-base-100 border-base-300 rounded-box border p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        ) : isError ? (
          <div className="alert alert-error rounded-xl">
            <span>Failed to load documents. Please try again.</span>
          </div>
        ) : data?.total > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="table-zebra table w-full">
                <thead>
                  <tr>
                    <th className="text-base-content/70">Name</th>
                    <th className="text-base-content/70">Owner</th>
                    <th className="text-base-content/70 hidden sm:table-cell">Last Modified</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.docs.map((doc: any) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-base-200 cursor-pointer transition-colors"
                      onClick={() => handleDocumentClick(doc.slug)}>
                      <td className="max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <LuFileText size={18} className="text-base-content/40 shrink-0" />
                          <span
                            className="text-base-content truncate font-medium"
                            title={doc.title}>
                            {doc.title}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-[150px]">
                        <div className="flex items-center gap-2">
                          {doc.ownerId ? (
                            <>
                              <Avatar
                                src={doc?.owner?.avatar_url || doc?.user?.avatar_url}
                                avatarUpdatedAt={
                                  doc?.owner?.avatar_updated_at || doc?.user?.avatar_updated_at
                                }
                                id={doc?.user?.id}
                                alt={doc?.owner?.display_name}
                                online={doc?.owner?.status === 'ONLINE'}
                                displayPresence={true}
                                size="xs"
                                className="shrink-0"
                              />
                              <span className="text-base-content/70 truncate text-sm">
                                {doc.user?.display_name}
                              </span>
                            </>
                          ) : (
                            <span className="text-base-content/40 text-sm">Unknown</span>
                          )}
                        </div>
                      </td>
                      <td className="text-base-content/60 hidden text-sm sm:table-cell">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <div className="join">
                  <Button
                    size="sm"
                    className="join-item"
                    onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    startIcon={LuChevronLeft}
                  />
                  {renderPaginationButtons()}
                  <Button
                    size="sm"
                    className="join-item"
                    onClick={() => handlePageChange(Math.min(totalPages - 1, currentPage + 1))}
                    disabled={currentPage === totalPages - 1}
                    startIcon={LuChevronRight}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="bg-base-200 mb-3 flex size-12 items-center justify-center rounded-full">
              <LuFileText size={24} className="text-base-content/40" />
            </div>
            <p className="text-base-content text-sm font-semibold">No documents found</p>
            <p className="text-base-content/60 mt-1 text-xs">
              {searchQuery
                ? 'Try a different search term'
                : "You haven't created any documents yet"}
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

export default DocumentsContent
