import React from 'react'
import { useChatStore } from '@stores'
import { IoMdGitBranch } from 'react-icons/io'
import { RiArrowRightSLine } from 'react-icons/ri'

const Breadcrumb = () => {
  const { headingPath } = useChatStore((state) => state.chatRoom)

  if (!headingPath.length) return null

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ul className="menu p-1 menu-horizontal flex items-center menu-sm">
        {headingPath.map((heading: any, index: number) => {
          return (
            <React.Fragment key={index}>
              {index === 0 ? (
                <IoMdGitBranch size={18} className="mr-1" />
              ) : (
                <RiArrowRightSLine size={20} />
              )}
              <li key={index} aria-current={headingPath.length - 1 === index ? 'page' : undefined}>
                <div className="flex items-center whitespace-nowrap">
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

export default Breadcrumb
