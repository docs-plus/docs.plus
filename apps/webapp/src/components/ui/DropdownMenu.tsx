import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  type FloatingPortalProps,
  offset,
  type Placement,
  shift,
  useClick,
  useDismiss,
  useFloating,
  type useInteractions
} from '@floating-ui/react'
import { twMerge } from '@utils/twMerge'
import { type ReactNode, useCallback, useState } from 'react'

import { contextMenuPanelClassName, MenuListProvider, useMenuList } from './ContextMenu'
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
  /**
   * Portal target. A menu inside a modal portals into the modal, so its outside-press
   * dismiss counts the menu as inside.
   */
  portalRoot?: FloatingPortalProps['root']
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
  onOpenChange,
  portalRoot
}: DropdownMenuProps) {
  const [open, setOpenState] = useState(false)

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
  const { getReferenceProps, getFloatingProps, listProps } = useMenuList(context, setOpen, [
    click,
    dismiss
  ])

  return (
    <>
      {trigger({ ref: refs.setReference, getProps: getReferenceProps })}
      {isMounted && (
        <FloatingPortal root={portalRoot}>
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
              <MenuListProvider {...listProps}>{children}</MenuListProvider>
            </ul>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}
