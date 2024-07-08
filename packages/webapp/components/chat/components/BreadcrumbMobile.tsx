import React from 'react'
import { useChatStore } from '@stores'
import { IoMdGitBranch } from 'react-icons/io'
import { RiArrowRightSLine } from 'react-icons/ri'

const BreadcrumbMobile = () => {
  const { headingPath } = useChatStore((state) => state.chatRoom)

  if (!headingPath.length) return null

  return (
    <nav className="flex" aria-label="BreadcrumbMobile">
      <ul className="menu menu-horizontal menu-sm flex items-center p-0">
        {headingPath.map((heading: any, index: number) => {
          return (
            <React.Fragment key={index}>
              {index === 0 ? (
                <IoMdGitBranch size={18} className="mr-1" />
              ) : (
                <RiArrowRightSLine size={20} />
              )}
              <li key={index} aria-current={headingPath.length - 1 === index ? 'page' : undefined}>
                <div className="flex items-center whitespace-nowrap px-1">
                  {headingPath.length - 1 === index ? (
                    <span className="">{heading.text}</span>
                  ) : (
                    <a href={heading.url} target="_blank" className="">
                      {heading.text}
                    </a>
                  )}
                </div>
              </li>
            </React.Fragment>
          )
        })}
      </ul>
    </nav>
  )
}

export default BreadcrumbMobile
