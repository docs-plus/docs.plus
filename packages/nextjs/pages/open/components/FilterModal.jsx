import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'

const FilterModal = () => {
  const filterSearchRef = useRef(null)
  const [totalHeading, setTotalHeading] = useState(0)
  const [totalSearch, setTotalSearch] = useState(0)
  const [search, setSearch] = useState('');
  const router = useRouter()

  const countHeadings = () => {
    const headings = document.querySelectorAll('.title');
    setTotalHeading(headings.length);
    return headings;
  };

  const filterHeadings = (headings) => {
    const regex = new RegExp(search, 'i');
    const filteredHeadings = Array.from(headings).filter(heading => regex.test(heading.textContent));
    setTotalSearch(filteredHeadings.length);
  };

  useEffect(() => {
    const headings = countHeadings();
    filterHeadings(headings);
  }, [search]);

  const searchThroughHeading = (e) => {
    setSearch(e.target.value);

    if (e.key === 'Enter') {
      applySearch();
    }
  }

  const applySearch = () => {
    const search = filterSearchRef.current.value
    const mainDoc = router.query.slugs.at(0)
    window.location.href = `/open/${ mainDoc }/${ encodeURIComponent(search) }`
  }

  const closeFilterModal = () => {
    const bottomSideModal = document.querySelector('.nd_modal.bottom')
    const modalWrapper = bottomSideModal.querySelector('.modalWrapper');
    const modalBg = bottomSideModal.querySelector('.modalBg');

    modalWrapper.classList.remove('active')
    modalBg.classList.remove('active')

    modalBg.ontransitionend = () => {
      bottomSideModal.classList.add('hidden')
    };
  }

  return (
    <div className='h-full'>
      <div onTouchStart={closeFilterModal} onClick={closeFilterModal} className='modalBg h-full w-full bg-black opacity-40 absolute top-0 left-0 z-0'></div>
      <div className='modalWrapper h-3/6 w-full p-4  bg-white rounded-tr-2xl rounded-tl-2xl z-10 fixed bottom-0'>
        <div className='text-blue-600 py-2 mb-3 flex w-full  bg-white'>
          <p className="w-2/3">Filters</p>
          <div className='w-1/3 flex justify-items-end items-center justify-end flex-row'>
            <button onTouchStart={closeFilterModal} onClick={closeFilterModal} className='w-6 h-6 rounded-full bg-slate-200 text-black'>X</button>
          </div>
        </div>
        <div className='flex w-full justify-center align-middle'>
          <input
            id="filterSearchBox"
            className="p-1 px-2 w-10/12 rounded bg-slate-200 text-black"
            type="text"
            placeholder="Find"
            onKeyDown={searchThroughHeading}
            ref={filterSearchRef}
          />
          <p className="ml-2 text-sm w-2/12 leading-10">
            {totalSearch} of {totalHeading}
          </p>
        </div>

        <button onTouchStart={applySearch} onClick={applySearch} className='w-full p-2 border rounded mt-10'>Filter Contents</button>

      </div>
    </div>
  );
}

export default FilterModal;
