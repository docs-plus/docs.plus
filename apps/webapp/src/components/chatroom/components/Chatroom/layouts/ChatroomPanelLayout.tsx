import useResizeContainer from '@components/pages/document/components/chat/hooks/useResizeContainer'
import ResizeHandle from '@components/ui/ResizeHandle'
import { useChatStore } from '@stores'

type Props = {
  children: React.ReactNode
}

/** Docked desktop chat panel — border-top only; no drop shadow (§Pad Workspace Surfaces). */
export const ChatroomPanelLayout = ({ children }: Props) => {
  const { handleMouseDown, containerRef, height, isResizing, isContentHidden } =
    useResizeContainer()
  const headingPath = useChatStore((state) => state.chatRoom.headingPath)
  const headingTitle =
    headingPath.length > 0 ? (headingPath[headingPath.length - 1]?.text ?? '') : ''

  return (
    // Opacity-only entry on the panel (composer transform ban). Overshoot and
    // snap-close fade the inner column — same recipe as the TOC settle-to-rail.
    <div
      ref={containerRef}
      role="region"
      aria-label={headingTitle ? `Chat: ${headingTitle}` : 'Heading chat'}
      className={[
        'group/chat bg-base-100 border-base-300 absolute inset-x-0 bottom-0 z-[42] flex w-full flex-col border-t motion-safe:animate-[doc-content-in_200ms_ease-out_both]',
        !isResizing &&
          'motion-safe:transition-[height] motion-safe:duration-[var(--motion-overlay-in)] motion-safe:ease-out'
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ height: `${height}px` }}>
      <ResizeHandle
        orientation="horizontal"
        onMouseDown={handleMouseDown}
        isResizing={isResizing}
        className="z-50"
      />

      <div
        className={[
          'flex min-h-0 flex-1 flex-col',
          !isResizing &&
            'motion-safe:transition-opacity motion-safe:duration-[var(--motion-overlay-in)] motion-safe:ease-out',
          isContentHidden ? 'pointer-events-none overflow-hidden opacity-0' : 'opacity-100'
        ]
          .filter(Boolean)
          .join(' ')}>
        {children}
      </div>

      {/* Portal target for the message hover menu — lives inside the
          chatroom panel's stacking context so the menu's z-30 plays
          inside the same context as the toolbar and jump-to-present (both z-40).
          Empty by default; FloatingPortal appends children at runtime. */}
      <div id="chat-hover-portal" />
    </div>
  )
}
