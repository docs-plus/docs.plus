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
import { twMerge } from '@utils/twMerge'
import { createContext, forwardRef, useContext, useEffect, useRef, useState } from 'react'

import { useOverlayTransition } from './useOverlayTransition'

/** Shared shell for TOC + chatroom right-click menus — Tailwind flex column, not daisyUI `menu`. */
export const contextMenuPanelClassName =
  'flex flex-col list-none bg-base-100 border-base-300 m-0 min-w-[11rem] rounded-box border p-1.5 shadow-xl outline-none'

/** Row host focus look: `group` feeds the `ContextMenuRow` fill, the ring shows keyboard focus. */
export const contextMenuRowHostClassName =
  'group rounded-field focus-visible:ring-primary outline-none focus-visible:ring-2 focus-visible:ring-inset'

export type ContextMenuRowVariant = 'default' | 'primary' | 'danger'

type ContextMenuRowProps = {
  /** Leading 16px glyph. A group gives every row an icon, or none. */
  icon?: React.ReactNode
  children: React.ReactNode
  variant?: ContextMenuRowVariant
  /** Fill without hover or focus: a listbox row that `aria-activedescendant` points at. */
  active?: boolean
  disabled?: boolean
  /** End slot, such as the check on a selected option. */
  trailing?: React.ReactNode
  className?: string
}

const contextMenuRowInk: Record<ContextMenuRowVariant, string> = {
  default: '',
  primary: 'text-primary',
  danger: 'text-error'
}

/**
 * The one menu and listbox row. Hover and keyboard focus fill it through the parent's `group`
 * (`MenuItem`); a listbox that keeps focus on its trigger passes `active` instead.
 */
export function ContextMenuRow({
  icon,
  children,
  variant = 'default',
  active = false,
  disabled = false,
  trailing,
  className
}: ContextMenuRowProps) {
  return (
    <span
      className={twMerge(
        'rounded-field flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-sm transition-colors duration-150',
        contextMenuRowInk[variant],
        disabled
          ? 'text-base-content/40 cursor-not-allowed'
          : 'group-hover:bg-base-200 group-focus-visible:bg-base-200 group-active:bg-base-300 cursor-pointer',
        active && !disabled && 'bg-base-200',
        className
      )}>
      {icon && (
        <span
          className={twMerge('flex-shrink-0', variant === 'default' && !disabled && 'opacity-70')}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 font-medium">{children}</span>
      {trailing && <span className="flex shrink-0 items-center">{trailing}</span>}
    </span>
  )
}

/** `as="div"` for a panel of plain buttons, where an `<li>` is invalid markup. */
export function ContextMenuDivider({
  className,
  as: Tag = 'li'
}: {
  className?: string
  as?: 'li' | 'div'
}) {
  return (
    <Tag
      role="separator"
      aria-hidden
      className={twMerge('bg-base-300 pointer-events-none my-1 h-px shrink-0 p-0', className)}
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

type MenuListProviderProps = {
  value: ContextMenuContextType
  elementsRef: React.RefObject<Array<HTMLElement | null>>
  labelsRef?: React.RefObject<Array<string | null>>
  children: React.ReactNode
}

/**
 * Lets a floating panel other than `ContextMenu` host `MenuItem` rows. The host owns
 * `useListNavigation` + `useTypeahead` over the same refs and passes their `getItemProps`.
 */
export function MenuListProvider({
  value,
  elementsRef,
  labelsRef,
  children
}: MenuListProviderProps) {
  return (
    <ContextMenuContext.Provider value={value}>
      <FloatingList elementsRef={elementsRef} labelsRef={labelsRef}>
        {children}
      </FloatingList>
    </ContextMenuContext.Provider>
  )
}

type MenuItemProps = React.LiHTMLAttributes<HTMLLIElement> & {
  ref?: React.Ref<HTMLLIElement>
  /** Skipped by arrow keys and ignores clicks. Pass the same flag to its `ContextMenuRow`. */
  disabled?: boolean
}

/**
 * Registers via `useListItem` (Floating UI's `FloatingList`), not DOM position, so keyboard
 * and focus wiring reaches rows through any wrapper the caller nests them in.
 * Throws outside a `ContextMenu` or `MenuListProvider`. Clicking does not close the menu;
 * the caller owns `setIsOpen(false)`.
 */
export function MenuItem({
  children,
  ref,
  className,
  onKeyDown,
  onClick,
  disabled = false,
  ...props
}: MenuItemProps) {
  const { activeIndex, getItemProps } = useContextMenuContext()
  const { ref: itemRef, index } = useListItem()
  const mergedRef = useMergeRefs([ref, itemRef])

  return (
    <li
      role="menuitem"
      aria-disabled={disabled || undefined}
      className={twMerge(
        contextMenuRowHostClassName,
        'cursor-pointer',
        disabled && 'cursor-not-allowed',
        className
      )}
      {...getItemProps({
        ref: mergedRef,
        tabIndex: activeIndex === index ? 0 : -1,
        ...props,
        onClick(e: React.MouseEvent<HTMLElement>) {
          if (disabled) return
          onClick?.(e as React.MouseEvent<HTMLLIElement>)
        },
        onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
          onKeyDown?.(e as React.KeyboardEvent<HTMLLIElement>)
          // <li> gets no native Enter/Space-to-click; useListNavigation only
          // moves focus, so activation has to be wired here.
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!disabled) e.currentTarget.click()
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
