import React, { type ReactNode } from 'react'

// The row frame stays real; only the title text is a bone. The real `menu` markup
// would paint stock styles first, because `_tableOfContents.scss` loads late. So this
// copies the `.toc__list`, `.toc__header` and nest rail rules from that file, and the
// daisyUI `menu` row and nest rules, by hand.
const Row = ({ widthClassName }: { widthClassName: string }) => (
  <div className="flex min-h-8 items-center gap-2 px-3 py-1.5">
    <span className="ms-1 size-5 shrink-0" />
    <div className={`skeleton h-3.5 max-w-full ${widthClassName}`} />
    <span className="size-6 shrink-0" />
  </div>
)

const Nest = ({ children }: { children: ReactNode }) => (
  <div className="before:bg-base-content/10 relative ms-4 before:absolute before:inset-y-3 before:start-2.5 before:w-[var(--border)]">
    {children}
  </div>
)

const TableOfContentsLoader: React.FC<React.HTMLProps<HTMLDivElement>> = (props) => {
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
        <Row widthClassName="w-32" />
        <Nest>
          <Row widthClassName="w-36" />
          <Nest>
            <Row widthClassName="w-28" />
            <Row widthClassName="w-20" />
          </Nest>
          <Row widthClassName="w-24" />
          <Row widthClassName="w-32" />
        </Nest>
        <Row widthClassName="w-24" />
        <Nest>
          <Row widthClassName="w-28" />
          <Row widthClassName="w-20" />
          <Nest>
            <Row widthClassName="w-32" />
            <Nest>
              <Row widthClassName="w-20" />
              <Row widthClassName="w-28" />
            </Nest>
          </Nest>
        </Nest>
        <Row widthClassName="w-28" />
        <Nest>
          <Row widthClassName="w-32" />
          <Row widthClassName="w-24" />
        </Nest>
        <Row widthClassName="w-20" />
        <Nest>
          <Row widthClassName="w-28" />
          <Row widthClassName="w-24" />
        </Nest>
      </div>
    </div>
  )
}

export default TableOfContentsLoader
