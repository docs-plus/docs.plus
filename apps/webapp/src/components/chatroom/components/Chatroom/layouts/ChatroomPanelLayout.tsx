import useResizeContainer from '@components/pages/document/components/chat/hooks/useResizeContainer'
import ResizeHandle from '@components/ui/ResizeHandle'

type Props = {
  children: React.ReactNode
}

/** Docked desktop chat panel — border-top only; no drop shadow (§Pad Workspace Surfaces). */
export const ChatroomPanelLayout = ({ children }: Props) => {
  const { handleMouseDown, containerRef, height, isResizing } = useResizeContainer()

  return (
    // Opacity-only entry: the panel hosts the TipTap composer, and transforms above
    // ProseMirror are forbidden (containing-block/caret hazards). Exit unmounts instantly.
    <div
      ref={containerRef}
      className="group/chat bg-base-100 border-base-300 absolute inset-x-0 bottom-0 z-40 flex w-full flex-col border-t motion-safe:animate-[doc-content-in_200ms_ease-out_both]"
      style={{ height: `${height}px` }}>
      <ResizeHandle
        orientation="horizontal"
        onMouseDown={handleMouseDown}
        isResizing={isResizing}
        className="z-50"
      />

      {/* Chat content */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      {/* Portal target for the message hover menu — lives inside the
          chatroom panel's stacking context so the menu's z-30 plays
          inside the same context as toolbar z-50 and jump-to-present z-40.
          Empty by default; FloatingPortal appends children at runtime. */}
      <div id="chat-hover-portal" />
    </div>
  )
}
