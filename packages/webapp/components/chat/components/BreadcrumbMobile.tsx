import React from 'react'
import { useChatStore } from '@stores'
import { IoMdGitBranch } from 'react-icons/io'
import { RiArrowRightSLine } from 'react-icons/ri'
import { BsThreeDots } from 'react-icons/bs'

const BreadcrumbMobile = () => {
  const { headingPath } = useChatStore((state) => state.chatRoom)

  if (!headingPath.length) return null

  const firstHeading = headingPath[0]
  const lastHeading = headingPath[headingPath.length - 1]
  const middleHeadings = headingPath.slice(1, headingPath.length - 1)

  return (
    <nav className="flex w-full items-center " aria-label="BreadcrumbMobile">
      <ul className="menu menu-horizontal menu-sm flex w-full max-w-full flex-nowrap items-center p-0">
        <IoMdGitBranch size={18} className="mr-1 shrink-0" />
        <li className="shrink-0">
          <div className="flex items-center whitespace-nowrap">
            <a href={firstHeading.url} target="_blank" className="truncate">
              {firstHeading.text}
            </a>
          </div>
        </li>

        {middleHeadings.length > 0 && (
          <React.Fragment>
            <RiArrowRightSLine size={20} className="shrink-0" />
            <div className="dropdown shrink-0">
              <button tabIndex={0} role="button" className="btn btn-ghost btn-sm">
                <BsThreeDots size={24} />
              </button>
              <ul
                tabIndex={0}
                className="menu dropdown-content z-[1] w-52 rounded-box bg-base-100 p-2 shadow">
                {middleHeadings.map((heading: any, index: number) => (
                  <li key={index}>
                    <div className="flex items-center whitespace-nowrap">
                      <a href={heading.url} target="_blank" className="truncate">
                        {heading.text}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </React.Fragment>
        )}

        <RiArrowRightSLine size={20} className="shrink-0" />
        <li aria-current="page" className="min-w-0 flex-1">
          <div className="flex max-w-full items-center overflow-hidden whitespace-nowrap">
            <span className="truncate">{lastHeading.text}</span>
          </div>
        </li>
      </ul>
    </nav>
  )
}

export default BreadcrumbMobile
