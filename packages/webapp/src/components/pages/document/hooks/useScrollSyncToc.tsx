import { useChatStore } from '@stores'
import { useEffect, RefObject } from 'react'

// helper fn
const scrollHeadingSelection = (event: any) => {
  const scrollTop = event.currentTarget.scrollTop

  const toc = document.querySelector('.toc__list')
  if (!toc) return
  const tocLis = [...toc.querySelectorAll('.toc__item')]
  const closest = tocLis
    .map((li) => {
      li.classList.remove('focusSight')
      return li
    })
    .filter((li) => {
      const thisOffsetTop = +(li?.getAttribute('data-offsettop') || 0) - 240
      return thisOffsetTop <= scrollTop // && nextSiblingOffsetTop >= scrollTop
    })

  closest.at(-1)?.classList.add('focusSight')

  // Scroll with 10px padding from top using getBoundingClientRect
  const targetElement = closest.at(-1)
  if (targetElement) {
    const toc = document.querySelector('.toc__list')
    if (toc && toc.parentElement) {
      const tocContainer = toc.parentElement
      const targetRect = targetElement.getBoundingClientRect()
      const containerRect = tocContainer.getBoundingClientRect()

      const relativeTop = targetRect.top - containerRect.top + tocContainer.scrollTop
      tocContainer.scrollTo({
        top: Math.max(0, relativeTop - 10),
        behavior: 'smooth'
      })
    }
  }
}

// hook fn
const useScrollSyncToc = (editorWrapperRef: RefObject<HTMLDivElement | null>) => {
  // handel scroll content to sync with toc
  useEffect(() => {
    const editorWrapper = editorWrapperRef.current
    if (!editorWrapper) return

    editorWrapper.addEventListener('scroll', scrollHeadingSelection)

    return () => {
      editorWrapper.removeEventListener('scroll', scrollHeadingSelection)
    }
  }, [editorWrapperRef])
}

export default useScrollSyncToc
