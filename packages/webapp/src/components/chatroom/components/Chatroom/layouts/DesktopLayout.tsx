import useResizeContainer from '@components/pages/document/components/chat/hooks/useResizeContainer'
import ResizeHandle from '@components/ui/ResizeHandle'

type Props = {
  children: React.ReactNode
}

/**
 * Desktop layout for the chatroom panel.
 *
 * Design System Requirements:
 * - Surface: bg-base-100 (primary canvas)
 * - Border: border-base-300
 * - Radius: rounded-box for panels (applied to top corners)
 * - Shadow: subtle elevation
 * - Resize handle: horizontal orientation
 */
export const DesktopLayout = ({ children }: Props) => {
  const { handleMouseDown, containerRef, height, isResizing } = useResizeContainer()

  return (
    <div
      ref={containerRef}
      className="group/chat bg-base-100 border-base-300 absolute bottom-0 z-40 flex w-full flex-col border-t shadow-lg"
      style={{ height: `${height}px` }}>
      {/* Resize Handle - Design System compliant */}
      <ResizeHandle
        orientation="horizontal"
        onMouseDown={handleMouseDown}
        isResizing={isResizing}
      />

      {/* Visual resize indicator - centered pill */}
      <div className="flex h-3 w-full items-center justify-center">
        <div
          onMouseDown={handleMouseDown}
          className="bg-base-300 hover:bg-primary/50 h-1 w-12 cursor-row-resize rounded-full transition-colors duration-150"
          aria-hidden="true"
        />
      </div>

      {/* Chat content */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
