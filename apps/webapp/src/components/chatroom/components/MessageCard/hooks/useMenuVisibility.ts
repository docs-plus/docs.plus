import { useEntryExitTransition } from '@hooks/useEntryExitTransition'

/**
 * Long-press-menu adapter over the shared transition hook: mounting and the
 * enter flag are split across frames so the enter transition actually paints.
 */
export const useMenuVisibility = () => {
  const { mounted, shown, show, hide, nodeRef } = useEntryExitTransition<HTMLDivElement>()

  return {
    isLongPressMenuVisible: mounted,
    isMenuEnterAnimationActive: shown,
    menuOverlayRef: nodeRef,
    showMenu: show,
    hideMenu: hide
  }
}
