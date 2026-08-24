import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingList,
  FloatingOverlay,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useListItem,
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead
} from '@floating-ui/react'
import { createContext, forwardRef, useContext, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useOverlayTransition } from './useOverlayTransition'

/** Shared shell for TOC + chatroom right-click menus — Tailwind flex column, not daisyUI `menu`. */
export const contextMenuPanelClassName =
  'flex flex-col list-none bg-base-100 border-base-300 m-0 min-w-[11rem] rounded-box border p-1.5 shadow-xl outline-none'

export type ContextMenuRowVariant = 'default' | 'primary' | 'danger'

type ContextMenuRowProps = {
  icon: React.ReactNode
  children: React.ReactNode
  variant?: ContextMenuRowVariant
  className?: string
  dimIcon?: boolean
}

const contextMenuRowVariantClass: Record<ContextMenuRowVariant, string> = {
  default: 'group-hover:bg-base-300 group-active:bg-base-300/90',
  primary: 'group-hover:bg-base-300 group-active:bg-base-300/90 text-primary',
  danger: 'group-hover:bg-error/20 group-active:bg-error/25 text-error'
}

export function ContextMenuRow({
  icon,
  children,
  variant = 'default',
  className,
  dimIcon = true
}: ContextMenuRowProps) {
  return (
    <span
      className={twMerge(
        'rounded-field flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-sm transition-colors duration-150',
        contextMenuRowVariantClass[variant],
        className
      )}>
      <span className={twMerge('flex-shrink-0', dimIcon && variant === 'default' && 'opacity-70')}>
        {icon}
      </span>
      <span className="font-medium">{children}</span>
    </span>
  )
}

export function ContextMenuDivider({ className }: { className?: string }) {
  return (
    <li
      role="separator"
      aria-hidden
      className={twMerge('bg-base-300 pointer-events-none my-[4px] h-px shrink-0 p-0', className)}
    />
  )
}

type ContextMenuItemProps = ReturnType<typeof useInteractions>['getItemProps']

interface ContextMenuContextType {
  setIsOpen: (open: boolean) => void
  isOpen: boolean
  activeIndex: number | null
  getItemProps: ContextMenuItemProps
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined)

export const useContextMenuContext = () => {
  const context = useContext(ContextMenuContext)
  if (!context) {
    throw new Error('useContextMenuContext must be used within ContextMenuContext.Provider')
  }
  return context
}

type MenuItemProps = React.LiHTMLAttributes<HTMLLIElement> & {
  ref?: React.Ref<HTMLLIElement>
}

/**
 * Registers via `useListItem` (Floating UI's `FloatingList`), not DOM position, so keyboard
 * and focus wiring reaches rows through any wrapper the caller nests them in.
 * Throws outside a `ContextMenu` provider — no longer a standalone `<li>`.
 * Clicking does not close the menu; the caller owns `setIsOpen(false)`.
 */
export function MenuItem({ children, ref, className, onKeyDown, ...props }: MenuItemProps) {
  const { activeIndex, getItemProps } = useContextMenuContext()
  const { ref: itemRef, index } = useListItem()
  const mergedRef = useMergeRefs([ref, itemRef])

  return (
    <li
      role="menuitem"
      className={twMerge('group rounded-field cursor-pointer', className)}
      {...getItemProps({
        ref: mergedRef,
        tabIndex: activeIndex === index ? 0 : -1,
        ...props,
        onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
          onKeyDown?.(e as React.KeyboardEvent<HTMLLIElement>)
          // <li> gets no native Enter/Space-to-click; useListNavigation only
          // moves focus, so activation has to be wired here.
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.currentTarget.click()
          }
        }
      })}>
      {children}
    </li>
  )
}

interface Props {
  parentRef?: React.RefObject<HTMLElement | null>
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  mousePosition?: { x: number; y: number } | null
  onBeforeShow?: (e: MouseEvent, target: EventTarget | null) => Element | null
  onClose?: () => void
}

export const ContextMenu = forwardRef<HTMLUListElement, Props & React.HTMLProps<HTMLUListElement>>(
  (
    {
      children,
      parentRef,
      className,
      isOpen: externalIsOpen,
      onOpenChange,
      mousePosition,
      onBeforeShow,
      onClose
    },
    ref
  ) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null)
    const [internalIsOpen, setInternalIsOpen] = useState(false)

    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
    const setIsOpen = onOpenChange || setInternalIsOpen

    // Populated by each MenuItem's useListItem() — not DOM position — so
    // wrapper components (TocContextMenu, ContextMenuItems, …) don't break it.
    const listItemsRef = useRef<Array<HTMLLIElement | null>>([])
    const listContentRef = useRef<Array<string | null>>([])
    const allowMouseUpCloseRef = useRef(false)

    const { refs, floatingStyles, context } = useFloating({
      open: isOpen,
      onOpenChange: setIsOpen,
      // left/top positioning — the overlay transition animates `transform: scale()`.
      transform: false,
      middleware: [
        offset({ mainAxis: 5, alignmentAxis: 4 }),
        flip({
          fallbackPlacements: ['left-start']
        }),
        shift({ padding: 10 })
      ],
      placement: 'right-start',
      strategy: 'fixed',
      whileElementsMounted: autoUpdate
    })

    // Menu tier: 120ms scale-in from the cursor side, instant dismissal.
    const { isMounted, styles: transitionStyles } = useOverlayTransition(context, { closeMs: 0 })

    useEffect(() => {
      if (mousePosition && externalIsOpen) {
        refs.setPositionReference({
          getBoundingClientRect() {
            return {
              width: 0,
              height: 0,
              x: mousePosition.x,
              y: mousePosition.y,
              top: mousePosition.y,
              right: mousePosition.x,
              bottom: mousePosition.y,
              left: mousePosition.x
            }
          }
        })
      }
    }, [mousePosition, externalIsOpen, refs])

    const role = useRole(context, { role: 'menu' })
    const dismiss = useDismiss(context)
    const listNavigation = useListNavigation(context, {
      listRef: listItemsRef,
      onNavigate: setActiveIndex,
      activeIndex
    })
    const typeahead = useTypeahead(context, {
      enabled: isOpen,
      listRef: listContentRef,
      onMatch: setActiveIndex,
      activeIndex
    })

    const { getFloatingProps, getItemProps } = useInteractions([
      role,
      dismiss,
      listNavigation,
      typeahead
    ])

    useEffect(() => {
      if (externalIsOpen !== undefined) return

      let timeout: number

      function onContextMenu(e: MouseEvent) {
        e.preventDefault()

        if (onBeforeShow) {
          const targetElement = onBeforeShow(e, e.target)
          if (!targetElement) return
        }

        // Always position at mouse click location, regardless of target element
        // The target element is used for context/validation, not positioning
        refs.setPositionReference({
          getBoundingClientRect() {
            return {
              width: 0,
              height: 0,
              x: e.clientX,
              y: e.clientY,
              top: e.clientY,
              right: e.clientX,
              bottom: e.clientY,
              left: e.clientX
            }
          }
        })

        clearTimeout(timeout)
        setIsOpen(true)

        allowMouseUpCloseRef.current = false
        timeout = window.setTimeout(() => {
          allowMouseUpCloseRef.current = true
        }, 300)
      }

      function onMouseUp(e: MouseEvent) {
        const menuElement = refs.floating?.current
        const isInsideMenu = menuElement && menuElement.contains(e.target as Node)

        // Don't close on mouseup inside the menu — let click events handle it
        if (isInsideMenu) return

        if (allowMouseUpCloseRef.current) {
          setIsOpen(false)
          // Clear message context when closing via onBeforeShow pattern
          if (onBeforeShow && onOpenChange) {
            onOpenChange(false)
          }
          onClose?.()
        }
      }

      const parent = parentRef?.current
      parent?.addEventListener('contextmenu', onContextMenu)
      document.addEventListener('mouseup', onMouseUp)
      return () => {
        parent?.removeEventListener('contextmenu', onContextMenu)
        document.removeEventListener('mouseup', onMouseUp)
        clearTimeout(timeout)
      }
      // onClose is intentionally omitted to avoid re-binding the listener
      // every render when the parent doesn't memoize the callback.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refs, parentRef, externalIsOpen, setIsOpen, onBeforeShow, onOpenChange])

    useEffect(() => {
      if (!isOpen && onClose) {
        onClose()
      }
      // onClose intentionally omitted; firing on identity change would
      // double-invoke the parent's handler on every render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    if (!parentRef?.current && externalIsOpen === undefined) return null

    if (!isMounted) return null

    return (
      <ContextMenuContext.Provider value={{ setIsOpen, isOpen, activeIndex, getItemProps }}>
        <FloatingPortal>
          <FloatingOverlay lockScroll>
            <FloatingFocusManager context={context} initialFocus={refs.floating}>
              <ul
                className={className}
                ref={refs.setFloating || ref}
                style={{ ...floatingStyles, ...transitionStyles }}
                {...getFloatingProps()}>
                <FloatingList elementsRef={listItemsRef} labelsRef={listContentRef}>
                  {children}
                </FloatingList>
              </ul>
            </FloatingFocusManager>
          </FloatingOverlay>
        </FloatingPortal>
      </ContextMenuContext.Provider>
    )
  }
)

ContextMenu.displayName = 'ContextMenu'
