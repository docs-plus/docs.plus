import React, { useState, useEffect, useRef, RefObject } from 'react'
import { useRouter } from 'next/router'
import { IoClose } from 'react-icons/io5'

const FilterModal = () => {
  const filterSearchRef: RefObject<HTMLInputElement> = useRef(null)
  const [totalHeading, setTotalHeading] = useState(0)
  const [totalSearch, setTotalSearch] = useState(0)
  const [search, setSearch] = useState('')
  const router = useRouter()

  const countHeadings = () => {
    const headings = document.querySelectorAll('.title')
    setTotalHeading(headings.length)
    return headings
  }

  useEffect(() => {
    const headings = countHeadings()

    const filterHeadings = (headings: any) => {
      const regex = new RegExp(search, 'i')
      const filteredHeadings = Array.from(headings).filter((heading: any) =>
        regex.test(heading.textContent)
      )
      setTotalSearch(filteredHeadings.length)
    }

    filterHeadings(headings)
  }, [search])

  const searchThroughHeading = (e: any) => {
    setSearch(e.target.value)

    if (e.key === 'Enter') {
      applySearch()
    }
  }

  const applySearch = () => {
    const search = filterSearchRef.current?.value
    const mainDoc = router.query.slugs?.[0] // Add nullish coalescing operator
    if (search) window.location.href = `/${mainDoc}/${encodeURIComponent(search)}`
  }

  const closeFilterModal = () => {
    const bottomSideModal = document.querySelector('.nd_modal.bottom') as HTMLElement
    const modalWrapper = bottomSideModal.querySelector('.modalWrapper') as HTMLElement
    const modalBg = bottomSideModal.querySelector('.modalBg') as HTMLElement

    modalWrapper.classList.remove('active')
    modalBg.classList.remove('active')

    modalBg.ontransitionend = () => {
      bottomSideModal.classList.add('hidden')
    }
  }

  return (
    <div className="h-full">
      <div
        onTouchStart={closeFilterModal}
        onClick={closeFilterModal}
        className="modalBg absolute left-0 top-0 z-0 size-full bg-black opacity-40"></div>
      <div className="modalWrapper fixed bottom-0 z-10  h-3/6 w-full rounded-t-2xl bg-white p-4">
        <div className="mb-3 flex w-full bg-white py-2  text-blue-600">
          <p className="w-2/3">Filters</p>
          <div className="flex w-1/3 flex-row items-center justify-end justify-items-end">
            <button
              onTouchStart={closeFilterModal}
              onClick={closeFilterModal}
              className="btn btn-circle btn-xs ml-2">
              <IoClose size={20} />
            </button>
          </div>
        </div>
        <div className="flex w-full justify-center align-middle">
          <input
            id="filterSearchBox"
            className="w-10/12 rounded bg-slate-200 p-1 px-2 text-black"
            type="text"
            placeholder="Find"
            onKeyDown={searchThroughHeading}
            ref={filterSearchRef}
          />
          <p className="ml-2 w-2/12 text-sm leading-10">
            {totalSearch} of {totalHeading}
          </p>
        </div>

        <button
          onTouchStart={applySearch}
          onClick={applySearch}
          className="mt-10 w-full rounded border p-2 outline-0">
          Filter Contents
        </button>
      </div>
    </div>
  )
}

export default FilterModal
