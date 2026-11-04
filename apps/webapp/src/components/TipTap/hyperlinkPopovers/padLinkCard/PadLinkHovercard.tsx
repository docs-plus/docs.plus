import { popoverPanelClassName } from '@components/ui/Popover'
import { useOverlayTransition } from '@components/ui/useOverlayTransition'
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
  useMergeRefs
} from '@floating-ui/react'
import { useStore } from '@stores'
import { twMerge } from '@utils/twMerge'

import { padNavigate } from '../hrefEventHandler'
import { PadLinkCard } from './PadLinkCard'
import { usePadLinkHovercard } from './usePadLinkHovercard'

const GAP_PX = 8

/**
 * The hovercard for docs.plus links on the desktop pad: another pad, or a place in this one.
 * Web links keep the extension's card. No `FloatingFocusManager`: its `markOthers` would stamp
 * the editor and reload its embeds. Dismiss is hand-rolled to match the extension's keys.
 */
export function PadLinkHovercard() {
  const editor = useStore((state) => state.settings.editor.instance)
  const { card, open, cardRef, close } = usePadLinkHovercard(editor ?? null)

  const { refs, floatingStyles, context } = useFloating({
    open,
    elements: { reference: card?.link ?? null },
    placement: 'bottom-start',
    strategy: 'fixed',
    transform: false,
    middleware: [offset(GAP_PX), flip({ padding: GAP_PX }), shift({ padding: GAP_PX })],
    whileElementsMounted: autoUpdate
  })
  const { isMounted, styles: transitionStyles } = useOverlayTransition(context)
  const floatingRef = useMergeRefs([refs.setFloating, cardRef])

  if (!isMounted || !card) return null

  const onOpen = (newTab: boolean) => {
    close()
    padNavigate(card.href, { newTab })
  }

  return (
    <FloatingPortal>
      <div
        ref={floatingRef}
        data-testid="pad-link-hovercard"
        style={{ ...floatingStyles, ...transitionStyles }}
        // A press must not take focus, so the caret stays in the editor.
        onMouseDown={(e) => e.preventDefault()}
        className={twMerge(popoverPanelClassName, 'w-96 max-w-[calc(100vw-1rem)]')}>
        <PadLinkCard href={card.href} view={card.view} onOpen={onOpen} />
      </div>
    </FloatingPortal>
  )
}
