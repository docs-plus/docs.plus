import React from 'react'
import LinkItem from './LinkItem'
import { ILinkItem } from '../types'
import LinkItemEmpty from './LinkItemEmpty'

interface LinkItemsProps {
  links: ILinkItem[]
  showDescription: { [key: string]: boolean }
  toggleDescription: (url: string) => void
  handleRemoveLink: (id: string) => void
}

const LinkItems: React.FC<LinkItemsProps> = ({
  links,
  showDescription,
  toggleDescription,
  handleRemoveLink
}) => {
  if (links.length === 0) return <LinkItemEmpty />

  return (
    <>
      {links.map((link, index) => (
        <LinkItem
          key={link.url + index}
          link={link}
          showDescription={showDescription}
          toggleDescription={toggleDescription}
          handleRemoveLink={handleRemoveLink}
        />
      ))}
    </>
  )
}

export default LinkItems
