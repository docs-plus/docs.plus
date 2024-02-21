import { UIEvent } from 'react'

export const scrollHeadingSelection = (event: UIEvent<HTMLDivElement>) => {
  const scrollTop = event.currentTarget.scrollTop
  const toc = document.querySelector('.toc__list')
  if (!toc) return
  const tocLis = [...toc.querySelectorAll('.toc__item')]
  const closest = tocLis
    .map((li) => {
      li.classList.remove('active')
      return li
    })
    .filter((li) => {
      const thisOffsetTop = +(li?.getAttribute('data-offsettop') || 0) - 220
      return thisOffsetTop <= scrollTop // && nextSiblingOffsetTop >= scrollTop
    })
  closest.at(-1)?.classList.add('active')
  closest.at(-1)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest'
  })
}
