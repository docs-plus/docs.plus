import {
  arrow,
  autoUpdate,
  computePosition,
  flip,
  offset,
  Placement,
  shift} from '@floating-ui/dom'

// Logger utility for production debugging
class Logger {
  private static isDebugMode = false // Set to true for development debugging

  static debug(message: string, data?: any): void {
    if (this.isDebugMode) {
      console.debug(`[FloatingToolbar] ${message}`, data)
    }
  }

  static warn(message: string, data?: any): void {
    console.warn(`[FloatingToolbar] ${message}`, data)
  }

  static error(message: string, error?: any): void {
    console.error(`[FloatingToolbar] ${message}`, error)
  }
}

// HTML sanitizer utility
class HTMLSanitizer {
  private static allowedTags = ['div', 'span', 'button', 'a', 'strong', 'em', 'i', 'b', 'small']
  private static allowedAttributes = ['class', 'href', 'title', 'data-*', 'aria-*', 'role']

  static sanitize(html: string): string {
    try {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = html

      this.sanitizeElement(tempDiv)
      return tempDiv.innerHTML
    } catch (error) {
      Logger.error('HTML sanitization failed', error)
      // Fallback to text content only
      const div = document.createElement('div')
      div.textContent = html
      return div.innerHTML
    }
  }

  private static sanitizeElement(element: Element): void {
    const children = Array.from(element.children)

    children.forEach((child) => {
      if (!this.allowedTags.includes(child.tagName.toLowerCase())) {
        // Replace with safe span
        const span = document.createElement('span')
        span.textContent = child.textContent || ''
        child.parentNode?.replaceChild(span, child)
        return
      }

      // Remove dangerous attributes
      Array.from(child.attributes).forEach((attr) => {
        if (!this.isAttributeAllowed(attr.name)) {
          child.removeAttribute(attr.name)
        }
      })

      // Recursively sanitize children
      this.sanitizeElement(child)
    })
  }

  private static isAttributeAllowed(attrName: string): boolean {
    return this.allowedAttributes.some((allowed) => {
      if (allowed.endsWith('*')) {
        return attrName.startsWith(allowed.slice(0, -1))
      }
      return attrName === allowed
    })
  }
}

export interface FloatingToolbarOptions {
  /** The reference element to position the toolbar relative to OR coordinates */
  referenceElement?: HTMLElement

  /** Coordinates for positioning when no reference element is provided */
  coordinates?: {
    x: number
    y: number
    width?: number
    height?: number
    contextElement?: HTMLElement
  }

  /** The content to display in the toolbar (HTML string or HTMLElement) */
  content: string | HTMLElement

  /** Placement of the toolbar relative to the reference element */
  placement?: Placement

  /** Offset from the reference element */
  offset?: number

  /** Whether to show an arrow pointing to the reference element */
  showArrow?: boolean

  /** Custom CSS classes to add to the toolbar */
  className?: string

  /** Animation duration in milliseconds */
  animationDuration?: number

  /** Whether to auto-hide when clicking outside */
  autoHide?: boolean

  /** Enable keyboard navigation */
  enableKeyboardNav?: boolean

  /** Custom z-index for the toolbar */
  zIndex?: number

  /** Callback when toolbar is shown */
  onShow?: (toolbar: HTMLElement) => void

  /** Callback when toolbar is hidden */
  onHide?: (toolbar: HTMLElement) => void

  /** Callback when toolbar is destroyed */
  onDestroy?: (toolbar: HTMLElement) => void

  /** Callback for errors */
  onError?: (error: Error) => void
}

export interface FloatingToolbarInstance {
  /** The toolbar DOM element */
  element: HTMLElement

  /** Show the toolbar */
  show: () => Promise<void>

  /** Hide the toolbar */
  hide: () => Promise<void>

  /** Update the toolbar position */
  update: () => Promise<void>

  /** Destroy the toolbar and cleanup */
  destroy: () => Promise<void>

  /** Check if toolbar is currently visible */
  isVisible: () => boolean

  /** Update the content of the toolbar */
  setContent: (content: string | HTMLElement) => void

  /** Get the reference element (real or virtual) */
  getReferenceElement: () => any

  /** Focus the first focusable element in the toolbar */
  focus: () => void

  /** Update the reference element or coordinates for positioning */
  updateReference: (
    referenceElement?: HTMLElement,
    coordinates?: FloatingToolbarOptions['coordinates']
  ) => void
}

// Cleanup tracker for better memory management
class CleanupTracker {
  private cleanupFunctions = new Set<() => void>()
  private isDestroyed = false

  add(cleanup: () => void): void {
    if (this.isDestroyed) {
      Logger.warn('Attempted to add cleanup function after destruction')
      return
    }
    this.cleanupFunctions.add(cleanup)
  }

  remove(cleanup: () => void): void {
    this.cleanupFunctions.delete(cleanup)
  }

  executeAll(): void {
    if (this.isDestroyed) return

    const cleanups = Array.from(this.cleanupFunctions)
    this.cleanupFunctions.clear()

    cleanups.forEach((cleanup, index) => {
      try {
        cleanup()
      } catch (error) {
        Logger.error(`Cleanup function ${index} failed`, error)
      }
    })

    this.isDestroyed = true
  }

  clear(): void {
    this.cleanupFunctions.clear()
  }
}

class FloatingToolbarManager {
  private static instance: FloatingToolbarManager
  private currentToolbar: FloatingToolbarInstance | null = null
  private cleanupTracker = new CleanupTracker()

  static getInstance(): FloatingToolbarManager {
    if (!FloatingToolbarManager.instance) {
      FloatingToolbarManager.instance = new FloatingToolbarManager()
    }
    return FloatingToolbarManager.instance
  }

  private constructor() {
    // Handle page unload cleanup
    const handleUnload = () => this.cleanup()
    window.addEventListener('beforeunload', handleUnload)
    this.cleanupTracker.add(() => {
      window.removeEventListener('beforeunload', handleUnload)
    })

    Logger.debug('FloatingToolbarManager initialized')
  }

  private cleanup(): void {
    try {
      this.cleanupTracker.executeAll()
      Logger.debug('FloatingToolbarManager cleanup completed')
    } catch (error) {
      Logger.error('Cleanup failed', error)
    }
  }

  getCurrentToolbar(): FloatingToolbarInstance | null {
    return this.currentToolbar
  }

  isToolbarVisible(): boolean {
    return this.currentToolbar?.isVisible() ?? false
  }

  async hideCurrentToolbar(): Promise<void> {
    if (this.currentToolbar) {
      await this.currentToolbar.hide()
    }
  }

  async destroyCurrentToolbar(): Promise<void> {
    if (this.currentToolbar) {
      await this.currentToolbar.destroy()
      this.currentToolbar = null
    }
  }

  createToolbar(options: FloatingToolbarOptions): FloatingToolbarInstance {
    try {
      // Destroy any existing toolbar to prevent memory leaks
      if (this.currentToolbar) {
        this.currentToolbar.destroy().catch((error) => {
          Logger.error('Failed to destroy previous toolbar', error)
        })
      }

      const instance = this.createToolbarInstance(options)
      this.currentToolbar = instance

      Logger.debug('Toolbar created successfully')
      return instance
    } catch (error) {
      Logger.error('Failed to create toolbar', error)
      options.onError?.(error as Error)
      throw error
    }
  }

  private createToolbarInstance(options: FloatingToolbarOptions): FloatingToolbarInstance {
    const {
      referenceElement,
      coordinates,
      content,
      placement = 'bottom-start',
      offset: offsetValue = 8,
      showArrow = false,
      className = '',
      animationDuration = 100,
      autoHide = true,
      enableKeyboardNav = true,
      zIndex = 9999,
      onShow,
      onHide,
      onDestroy,
      onError
    } = options

    // Validate reference element or coordinates
    if (!referenceElement && !coordinates) {
      throw new Error('Invalid reference element or coordinates provided')
    }

    // Create reference element (real or virtual)
    let resolvedReference = referenceElement || this.createVirtualReference(coordinates!)
    const contextElement = coordinates?.contextElement || document.body

    // Local cleanup tracker for this instance
    const instanceCleanup = new CleanupTracker()

    // Create toolbar element with accessibility
    const toolbar = document.createElement('div')
    toolbar.className = `floating-toolbar ${className}`.trim()
    toolbar.setAttribute('role', 'toolbar')
    toolbar.setAttribute('aria-label', 'Floating toolbar')
    toolbar.setAttribute('tabindex', '-1')

    // Apply z-index and animation duration from options
    toolbar.style.zIndex = zIndex.toString()
    toolbar.style.setProperty('--animation-duration', `${animationDuration}ms`)

    // Create arrow element if needed
    let arrowElement: HTMLElement | null = null
    if (showArrow) {
      arrowElement = document.createElement('div')
      arrowElement.className = 'floating-toolbar-arrow'
      toolbar.appendChild(arrowElement)
    }

    // Create content container
    const contentContainer = document.createElement('div')
    contentContainer.className = 'floating-toolbar-content'
    contentContainer.setAttribute('role', 'group')
    toolbar.appendChild(contentContainer)

    // Safe content setter with sanitization
    const setContent = (newContent: string | HTMLElement): void => {
      try {
        if (typeof newContent === 'string') {
          const sanitizedHTML = HTMLSanitizer.sanitize(newContent)
          contentContainer.innerHTML = sanitizedHTML
        } else if (newContent instanceof HTMLElement) {
          contentContainer.innerHTML = ''
          contentContainer.appendChild(newContent)
        } else {
          throw new Error('Invalid content type provided')
        }

        // Set up keyboard navigation after content is set
        if (enableKeyboardNav) {
          this.setupKeyboardNavigation(toolbar)
        }
      } catch (error) {
        Logger.error('Failed to set toolbar content', error)
        onError?.(error as Error)
      }
    }

    // Set initial content
    setContent(content)

    // State management
    let isVisible = false
    let autoUpdateCleanup: (() => void) | null = null
    let animationFrame: number | null = null

    // Direct position update function
    const updatePosition = async (): Promise<void> => {
      if (!isVisible) return

      try {
        await this.updateToolbarPosition(
          resolvedReference,
          toolbar,
          arrowElement,
          placement,
          offsetValue
        )
      } catch (error) {
        Logger.error('Position update failed', error)
        onError?.(error as Error)
      }
    }

    // Show function with proper error handling
    const show = async (): Promise<void> => {
      if (isVisible) return

      try {
        // Add to DOM
        document.body.appendChild(toolbar)
        isVisible = true

        // Start auto-updating position
        autoUpdateCleanup = autoUpdate(resolvedReference, toolbar, updatePosition)
        instanceCleanup.add(() => {
          if (autoUpdateCleanup) {
            autoUpdateCleanup()
            autoUpdateCleanup = null
          }
        })

        // Initial position update
        await updatePosition()

        // Animate in with RAF for smooth animation
        animationFrame = requestAnimationFrame(() => {
          toolbar.classList.add('visible')
          animationFrame = null
        })

        // Setup auto-hide functionality
        if (autoHide) {
          this.setupAutoHide(toolbar, contextElement, hide, instanceCleanup)
        }

        // Setup keyboard handlers
        if (enableKeyboardNav) {
          this.setupKeyboardHandlers(toolbar, hide, instanceCleanup)
        }

        Logger.debug('Toolbar shown successfully')
        onShow?.(toolbar)
      } catch (error) {
        Logger.error('Failed to show toolbar', error)
        onError?.(error as Error)
        throw error
      }
    }

    // Hide function with cleanup
    const hide = async (): Promise<void> => {
      if (!isVisible) return

      try {
        isVisible = false

        // Cancel any pending animation
        if (animationFrame) {
          cancelAnimationFrame(animationFrame)
          animationFrame = null
        }

        // Clean up auto-update immediately
        if (autoUpdateCleanup) {
          autoUpdateCleanup()
          autoUpdateCleanup = null
        }

        // Animate out
        toolbar.classList.remove('visible')

        // Remove from DOM after animation
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            if (toolbar.parentNode) {
              toolbar.parentNode.removeChild(toolbar)
            }
            resolve()
          }, animationDuration)
        })

        Logger.debug('Toolbar hidden successfully')
        onHide?.(toolbar)
      } catch (error) {
        Logger.error('Failed to hide toolbar', error)
        onError?.(error as Error)
        throw error
      }
    }

    // Destroy function with comprehensive cleanup
    const destroy = async (): Promise<void> => {
      try {
        // Execute all cleanup functions
        instanceCleanup.executeAll()

        // Hide if visible
        if (isVisible) {
          await hide()
        }

        // Final cleanup
        setTimeout(() => {
          try {
            onDestroy?.(toolbar)
            Logger.debug('Toolbar destroyed successfully')
          } catch (error) {
            Logger.error('Destroy callback failed', error)
          }
        }, animationDuration)
      } catch (error) {
        Logger.error('Failed to destroy toolbar', error)
        onError?.(error as Error)
        throw error
      }
    }

    // Focus management
    const focus = (): void => {
      try {
        const focusableElements = toolbar.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstFocusable = focusableElements[0] as HTMLElement
        if (firstFocusable) {
          firstFocusable.focus()
        } else {
          toolbar.focus()
        }
      } catch (error) {
        Logger.error('Failed to focus toolbar', error)
      }
    }

    // Update reference element or coordinates
    const updateReference = (
      referenceElement?: HTMLElement,
      coordinates?: FloatingToolbarOptions['coordinates']
    ) => {
      if (referenceElement || coordinates) {
        resolvedReference = referenceElement || this.createVirtualReference(coordinates!)
        updatePosition()
      }
    }

    return {
      element: toolbar,
      show,
      hide,
      update: updatePosition,
      destroy,
      isVisible: () => isVisible,
      setContent,
      getReferenceElement: () => resolvedReference,
      focus,
      updateReference
    }
  }

  private createVirtualReference(coordinates: NonNullable<FloatingToolbarOptions['coordinates']>) {
    const { x, y, width = 0, height = 0 } = coordinates

    return {
      getBoundingClientRect: () => ({
        width,
        height,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
        x,
        y
      }),
      contextElement: coordinates.contextElement || document.body
    }
  }

  private async updateToolbarPosition(
    referenceElement: any,
    toolbar: HTMLElement,
    arrowElement: HTMLElement | null,
    placement: Placement,
    offsetValue: number
  ): Promise<void> {
    const middleware = [offset(offsetValue), flip(), shift({ padding: 8 })]

    if (arrowElement) {
      middleware.push(arrow({ element: arrowElement }))
    }

    const {
      x,
      y,
      placement: actualPlacement,
      middlewareData
    } = await computePosition(referenceElement, toolbar, {
      placement,
      middleware
    })

    // Batch DOM updates for better performance
    requestAnimationFrame(() => {
      toolbar.style.left = `${x}px`
      toolbar.style.top = `${y}px`

      // Position arrow
      if (arrowElement && middlewareData.arrow) {
        const { x: arrowX, y: arrowY } = middlewareData.arrow
        const placementSide = actualPlacement.split('-')[0]
        const staticSide = {
          top: 'bottom',
          right: 'left',
          bottom: 'top',
          left: 'right'
        }[placementSide] as string

        // Add class based on placement
        arrowElement.className = `floating-toolbar-arrow floating-toolbar-arrow-${placementSide}`

        Object.assign(arrowElement.style, {
          left: arrowX != null ? `${arrowX}px` : '',
          top: arrowY != null ? `${arrowY}px` : '',
          right: '',
          bottom: '',
          [staticSide]: '-5px'
        })
      }
    })
  }

  private setupAutoHide(
    toolbar: HTMLElement,
    contextElement: HTMLElement,
    hide: () => Promise<void>,
    cleanupTracker: CleanupTracker
  ): void {
    const handleOutsideInteraction = (target: Node | null) => {
      if (!target || toolbar.contains(target)) {
        return // Don't hide if clicking on toolbar
      }

      // Hide on any click outside the toolbar
      hide().catch((error) => Logger.error('Auto-hide failed', error))
    }

    // Mouse events
    const mouseHandler = (event: MouseEvent) => {
      handleOutsideInteraction(event.target as Node)
    }

    // Touch events
    const touchHandler = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        const touch = event.touches[0]
        const target = document.elementFromPoint(touch.clientX, touch.clientY)
        handleOutsideInteraction(target)
      }
    }

    // Add event listeners with slight delay
    setTimeout(() => {
      document.addEventListener('mousedown', mouseHandler, { passive: true })
      document.addEventListener('touchstart', touchHandler, { passive: true })

      cleanupTracker.add(() => {
        document.removeEventListener('mousedown', mouseHandler)
        document.removeEventListener('touchstart', touchHandler)
      })
    }, 100)
  }

  private setupKeyboardHandlers(
    toolbar: HTMLElement,
    hide: () => Promise<void>,
    cleanupTracker: CleanupTracker
  ): void {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        hide().catch((error) => Logger.error('Keyboard hide failed', error))
      }
    }

    toolbar.addEventListener('keydown', keyHandler)
    cleanupTracker.add(() => {
      toolbar.removeEventListener('keydown', keyHandler)
    })
  }

  private setupKeyboardNavigation(toolbar: HTMLElement): void {
    const focusableElements = toolbar.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>

    if (focusableElements.length === 0) return

    focusableElements.forEach((element, index) => {
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
          event.preventDefault()
          const nextIndex = event.shiftKey
            ? (index - 1 + focusableElements.length) % focusableElements.length
            : (index + 1) % focusableElements.length
          focusableElements[nextIndex].focus()
        }
      })
    })
  }
}

// Enhanced API functions with error handling
export const createFloatingToolbar = (options: FloatingToolbarOptions): FloatingToolbarInstance => {
  try {
    return FloatingToolbarManager.getInstance().createToolbar(options)
  } catch (error) {
    Logger.error('Failed to create floating toolbar', error)
    throw error
  }
}

export const getCurrentToolbar = (): FloatingToolbarInstance | null => {
  return FloatingToolbarManager.getInstance().getCurrentToolbar()
}

export const isToolbarVisible = (): boolean => {
  return FloatingToolbarManager.getInstance().isToolbarVisible()
}

export const hideCurrentToolbar = async (): Promise<void> => {
  await FloatingToolbarManager.getInstance().hideCurrentToolbar()
}

export const destroyCurrentToolbar = async (): Promise<void> => {
  await FloatingToolbarManager.getInstance().destroyCurrentToolbar()
}

export const updateCurrentToolbarPosition = (
  referenceElement?: HTMLElement,
  coordinates?: FloatingToolbarOptions['coordinates']
): void => {
  const currentToolbar = FloatingToolbarManager.getInstance().getCurrentToolbar()

  if (!currentToolbar) {
    Logger.warn('No current toolbar to update')
    return
  }

  if (!referenceElement && !coordinates) {
    Logger.warn('No reference element or coordinates provided for update')
    return
  }

  try {
    currentToolbar.updateReference(referenceElement, coordinates)
  } catch (error) {
    Logger.error('Failed to update toolbar position', error)
    throw error
  }
}

// Update toolbar position example
// With new reference element:
// updateCurrentToolbarPosition(newImageElement);

// With new coordinates:
// updateCurrentToolbarPosition(undefined, { x: 100, y: 200, width: 50, height: 30 });

// Enhanced usage example with production best practices
/*
import { createFloatingToolbar } from './floating-toolbar';

// Production-ready usage example
const imageElement = document.querySelector('img') as HTMLElement;

if (imageElement) {
  imageElement.addEventListener('click', async () => {
    try {
      const toolbar = createFloatingToolbar({
        referenceElement: imageElement,
        content: `
          <div style="display: flex; gap: 8px; padding: 8px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <button type="button" data-action="edit" style="padding: 4px 8px;">Edit</button>
            <button type="button" data-action="delete" style="padding: 4px 8px;">Delete</button>
            <button type="button" data-action="move" style="padding: 4px 8px;">Move</button>
          </div>
        `,
        placement: 'top',
        showArrow: true,
        enableKeyboardNav: true,
        onShow: (element) => console.log('Toolbar shown'),
        onHide: (element) => console.log('Toolbar hidden'),
        onError: (error) => console.error('Toolbar error:', error)
      });

      await toolbar.show();
      toolbar.focus(); // Focus for accessibility
    } catch (error) {
      console.error('Failed to show toolbar:', error);
    }
  });
}

// Event delegation for better performance
document.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  const action = target.getAttribute('data-action');

  if (action) {
    console.log(`Action: ${action}`);
    await hideCurrentToolbar();
  }
});

// Update toolbar position example
// With new reference element:
// updateCurrentToolbarPosition(newImageElement);

// With new coordinates:
// updateCurrentToolbarPosition(undefined, { x: 100, y: 200, width: 50, height: 30 });
*/
