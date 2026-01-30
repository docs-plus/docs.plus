import { EditorView } from '@tiptap/pm/view'

import type { ImageClickHandlerOptions, ImageKeyDownHandlerOptions } from '../../types'
import { createFloatingToolbar } from '../../utils/floating-toolbar'
import { createMediaToolbar } from '../../utils/media-toolbar'

// ![alt text](image_url) or [alt text](image_url)
export const inputRegex =
  /(?:^|\s)(!?\[([^\]]*)\]\(((?:https?:\/\/|\/\/).*\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff|avif|heic|heif|jxl|webm)(?:\?.*)?(?:#.*)?)\))(?=\s|$)/gi

// Image URL detection regex - matches common image extensions for HTTP(S) URLs
const httpImageUrlRegex =
  /^(?:https?:\/\/|\/\/).*\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff|avif|heic|heif|jxl|webm)(?:\?.*)?(?:#.*)?$/i

export const isImageUrl = (url: string): boolean => {
  // Handle data URLs
  if (url.startsWith('data:image/')) {
    return true
  }

  // Handle blob URLs (assume they're images if created for image purposes)
  if (url.startsWith('blob:')) {
    return true
  }

  // Handle HTTP(S) URLs with image extensions
  return httpImageUrlRegex.test(url)
}

export const imageClickHandler = (
  view: EditorView,
  event: MouseEvent | TouchEvent,
  options: ImageClickHandlerOptions
) => {
  // Handle mobile touch events properly
  // @ts-expect-error pointerType property access
  if (!event?.pointerType) return true

  const target = event.target as HTMLElement

  if (target && target.tagName.toLowerCase() === 'img') {
    // Don't interfere if toolbar is already visible for this image
    const mediaResizeGripper = target.previousSibling as HTMLElement
    if (mediaResizeGripper?.classList.contains('hypermultimedia__resize-gripper--active')) {
      return true
    }

    const toolbarElement = createMediaToolbar({
      target,
      view,
      editor: options.editor,
      nodeType: 'image'
    })

    const toolbar = createFloatingToolbar({
      referenceElement: target,
      content: options.toolbar
        ? typeof options.toolbar === 'function'
          ? options.toolbar(target) || ''
          : options.toolbar
        : toolbarElement,
      placement: 'bottom-start',
      offset: 6
    })

    toolbar.show()

    // if mediaresizeGripper does not exist for image, return
    if (!mediaResizeGripper) return

    mediaResizeGripper.style.width = `${target.clientWidth}px`
    mediaResizeGripper.style.height = `${target.clientHeight}px`
    mediaResizeGripper.style.left = `${target.offsetLeft}px`
    mediaResizeGripper.style.top = `${target.offsetTop}px`
    mediaResizeGripper.classList.add('hypermultimedia__resize-gripper--active')

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // @ts-expect-error pointerType property access
      if (!event.pointerType) return

      const clickTarget = event.target as HTMLElement

      // Don't hide if clicking on toolbar elements
      if (clickTarget?.closest('.floating-toolbar, .image-toolbar')) {
        return
      }

      if (clickTarget !== target) {
        removeResizeBorderAndListener()
      }
    }

    const handleResize = () => {
      removeResizeBorderAndListener()
    }

    const handleScroll = () => {
      removeResizeBorderAndListener()
    }

    const removeResizeBorderAndListener = () => {
      mediaResizeGripper.classList.remove('hypermultimedia__resize-gripper--active')
      // hideCurrentToolbar()

      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll)
    }

    document.addEventListener('click', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('touchend', handleClickOutside)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, { passive: true })

    // Prevent default behavior
    event.preventDefault()
    return true
  }

  return false
}

export const imageKeyDownHandler = (
  view: EditorView,
  event: KeyboardEvent,
  options: ImageKeyDownHandlerOptions
) => {
  const { selection, doc } = view.state
  const { from } = selection

  // Check if backspace (8) or delete (46) key is pressed
  if (event.key === 'Backspace' || event.key === 'Delete') {
    // Check if current selection is in an image node
    const node = doc.nodeAt(from)
    const isImageSelected = node && node.type.name === options.nodeName

    // Also check if we have a node selection that's an image
    const isNodeSelection =
      selection.constructor.name === 'NodeSelection' &&
      (selection as any).node &&
      (selection as any).node.type.name === options.nodeName

    if (!isImageSelected && !isNodeSelection) return false

    // Check if there's an active resize gripper
    const activeGripper = document.querySelector('.hypermultimedia__resize-gripper--active')
    if (activeGripper) {
      // Find the cleanup function for the associated image
      const mediaResizeGripper = activeGripper.previousSibling as HTMLElement
      if (mediaResizeGripper === activeGripper) {
        mediaResizeGripper.classList.remove('hypermultimedia__resize-gripper--active')
      }
    }
  }
  return false
}
