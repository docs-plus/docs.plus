import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  type Placement,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
  useTypeahead
} from '@floating-ui/react'
import { twMerge } from '@utils/twMerge'
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'

import { contextMenuPanelClassName, MenuListProvider } from './ContextMenu'
import { useOverlayTransition } from './useOverlayTransition'

// Non-modal, so excluding the editors costs no a11y. It keeps markOthers from stamping
// `data-floating-ui-inert` on a ProseMirror root, which recreates its node views.
const editorRoots = () => Array.from(document.querySelectorAll('.ProseMirror'))

export interface DropdownMenuTriggerProps {
  ref: ReturnType<typeof useFloating>['refs']['setReference']
  getProps: ReturnType<typeof useInteractions>['getReferenceProps']
}

export interface DropdownMenuProps {
  /** The trigger needs an `aria-label`: `useRole` names the menu after it. */
  trigger: (props: DropdownMenuTriggerProps) => ReactNode
  /** `MenuItem` rows with `ContextMenuRow` bodies; `ContextMenuDivider` between groups. */
  children: ReactNode
  placement?: Placement
  /** Merged onto the panel, such as `z-[60]` for a menu stacked on a floating surface. */
  className?: string
  onOpenChange?: (open: boolean) => void
}

/**
 * The click-opened action menu. Rows close it through `useContextMenuContext().setIsOpen(false)`;
 * focus returns to the trigger unless the row moved it (an editor command).
 */
export function DropdownMenu({
  trigger,
  children,
  placement = 'bottom-end',
  className,
  onOpenChange
}: DropdownMenuProps) {
  const [open, setOpenState] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const elementsRef = useRef<Array<HTMLElement | null>>([])
  const labelsRef = useRef<Array<string | null>>([])

  // One setter for every close path, so the host's onOpenChange never misses a row close.
  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next)
      onOpenChange?.(next)
    },
    [onOpenChange]
  )

  const { refs, floatingStyles, context } = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    // left/top positioning — the overlay transition animates `transform: scale()`.
    transform: false,
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })]
  })

  const { isMounted, styles: transitionStyles } = useOverlayTransition(context)

  const click = useClick(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'menu' })
  const listNavigation = useListNavigation(context, {
    listRef: elementsRef,
    activeIndex,
    onNavigate: setActiveIndex
  })
  const typeahead = useTypeahead(context, {
    enabled: open,
    listRef: labelsRef,
    activeIndex,
    onMatch: setActiveIndex
  })

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    dismiss,
    role,
    listNavigation,
    typeahead
  ])

  const menuListValue = useMemo(
    () => ({ isOpen: open, setIsOpen: setOpen, activeIndex, getItemProps }),
    [open, setOpen, activeIndex, getItemProps]
  )

  return (
    <>
      {trigger({ ref: refs.setReference, getProps: getReferenceProps })}
      {isMounted && (
        <FloatingPortal>
          <FloatingFocusManager
            context={context}
            modal={false}
            initialFocus={refs.floating}
            getInsideElements={editorRoots}>
            <ul
              ref={refs.setFloating}
              style={{ ...floatingStyles, ...transitionStyles, maxWidth: '100%' }}
              {...getFloatingProps()}
              className={twMerge(contextMenuPanelClassName, 'z-50', className)}>
              <MenuListProvider
                value={menuListValue}
                elementsRef={elementsRef}
                labelsRef={labelsRef}>
                {children}
              </MenuListProvider>
            </ul>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}
