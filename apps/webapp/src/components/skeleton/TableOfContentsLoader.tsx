import { Icons } from '@icons'
import React, { type ReactNode } from 'react'

// The row frame stays real; only the title text is a bone. `_tableOfContents.scss` loads
// late, so this copies its list, header, nest rail, fold and chat icon rules by hand,
// with the daisyUI `menu` row and nest rules. The real `menu` markup would paint stock
// styles first.
type RowProps = { widthClassName: string; hasChildren?: boolean }

// The caret slot stays blank under the option-A ruling (2026-10-09), so it ignores `hasChildren`.
const DesktopRow = ({ widthClassName }: RowProps) => (
  <div className="flex min-h-8 items-center gap-2 px-3 py-1.5">
    <span className="ms-1 size-5 shrink-0" />
    <div className={`skeleton h-3.5 max-w-full ${widthClassName}`} />
    <span className="size-6 shrink-0" />
  </div>
)

// Mobile always shows the chevron on a parent row and the chat icon, so both are frame.
// The chevron is drawn open because its nest shows. The 44px fold slot sets the 56px
// row; a leaf keeps it blank.
const MobileRow = ({ widthClassName, hasChildren }: RowProps) => (
  <div className="flex min-h-11 items-center gap-2 px-3 py-1.5">
    <span className="text-base-content/70 flex size-11 shrink-0 items-center justify-center">
      {hasChildren && (
        <Icons.chevronRight size={18} className="rotate-90 fill-none stroke-current" aria-hidden />
      )}
    </span>
    <div className="min-w-0 flex-1">
      <div className={`skeleton h-3.5 max-w-full ${widthClassName}`} />
    </div>
    <span className="text-base-content/60 flex size-6 shrink-0 items-center justify-center">
      <Icons.chatroom size={20} className="fill-none stroke-current p-px" aria-hidden />
    </span>
  </div>
)

const Nest = ({ children }: { children: ReactNode }) => (
  <div className="before:bg-base-content/10 relative ms-4 before:absolute before:inset-y-3 before:start-2.5 before:w-[var(--border)]">
    {children}
  </div>
)

const Outline = ({ Row }: { Row: React.FC<RowProps> }) => (
  <>
    <Row widthClassName="w-32" hasChildren />
    <Nest>
      <Row widthClassName="w-36" hasChildren />
      <Nest>
        <Row widthClassName="w-28" />
        <Row widthClassName="w-20" />
      </Nest>
      <Row widthClassName="w-24" />
      <Row widthClassName="w-32" />
    </Nest>
    <Row widthClassName="w-24" hasChildren />
    <Nest>
      <Row widthClassName="w-28" />
      <Row widthClassName="w-20" hasChildren />
      <Nest>
        <Row widthClassName="w-32" hasChildren />
        <Nest>
          <Row widthClassName="w-20" />
          <Row widthClassName="w-28" />
        </Nest>
      </Nest>
    </Nest>
    <Row widthClassName="w-28" hasChildren />
    <Nest>
      <Row widthClassName="w-32" />
      <Row widthClassName="w-24" />
    </Nest>
    <Row widthClassName="w-20" hasChildren />
    <Nest>
      <Row widthClassName="w-28" />
      <Row widthClassName="w-24" />
    </Nest>
  </>
)

type TableOfContentsLoaderProps = React.HTMLProps<HTMLDivElement> & {
  /** `mobile` mirrors `TocMobile` in the drawer body; the drawer renders `TocHeader` itself. */
  density?: 'desktop' | 'mobile'
}

const TableOfContentsLoader: React.FC<TableOfContentsLoaderProps> = ({
  density = 'desktop',
  ...props
}) => {
  if (density === 'mobile') {
    return (
      <div {...props} className={['w-full pt-2 pb-6', props.className].filter(Boolean).join(' ')}>
        <div className="my-2 ps-2.5 pe-1.5">
          <Outline Row={MobileRow} />
        </div>
      </div>
    )
  }

  return (
    <div
      {...props}
      className={['flex h-full min-h-0 w-full flex-col', props.className]
        .filter(Boolean)
        .join(' ')}>
      <div className="ps-2.5 pe-1.5">
        <div className="border-base-300 mb-1 border-b pt-2 pb-1">
          <div className="flex min-h-8 items-center gap-2 px-3 py-1.5">
            <span />
            <div className="skeleton h-4 w-36 max-w-full" />
            <span className="size-6 shrink-0" />
          </div>
        </div>
        <Outline Row={DesktopRow} />
      </div>
    </div>
  )
}

export default TableOfContentsLoader
