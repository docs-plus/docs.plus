import { useState } from 'react'

import type { DocumentGridPreview } from '../types'

const LINE_MAX = 80
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g

const isHttpSrc = (src: string): boolean => /^https?:\/\//i.test(src)

const normalizeTitle = (title: string): string =>
  title.replace(/\s+/g, ' ').replace(CONTROL_CHARS, '').trim().slice(0, LINE_MAX)

const visibleHeading = (
  heading: string | null | undefined,
  title: string | null | undefined
): string | null => {
  if (!heading) return null
  if (title == null) return heading
  return heading === normalizeTitle(title) ? null : heading
}

interface DocumentPreviewPaperProps {
  preview?: DocumentGridPreview | null
  title?: string | null
  variant: 'tile' | 'row'
}

/** Heading that equals Title is omitted here, not in the stored extract. */
function DocumentPreviewPaper({ preview, title, variant }: DocumentPreviewPaperProps) {
  const [hideImage, setHideImage] = useState(false)
  const heading = visibleHeading(preview?.heading, title)
  const lines = preview?.lines ?? []
  const list = preview?.list ?? []
  const imageSrc =
    preview?.imageSrc && !hideImage && isHttpSrc(preview.imageSrc) ? preview.imageSrc : undefined
  const empty = preview != null && !heading && lines.length === 0 && list.length === 0 && !imageSrc

  const body =
    empty && variant === 'tile' ? (
      <span
        className="text-base-content/30 absolute inset-0 grid place-items-center text-[9px]"
        aria-hidden>
        Empty document
      </span>
    ) : preview != null ? (
      <>
        {heading ? (
          <span
            className={
              variant === 'tile'
                ? 'mb-1.5 block text-[11px] leading-tight font-bold'
                : 'mb-0.5 block truncate text-[7px] leading-tight font-bold'
            }>
            {heading}
          </span>
        ) : null}
        {lines.map((line, i) => (
          <span
            key={i}
            className={
              variant === 'tile'
                ? 'text-base-content/80 mb-1.5 block text-[7.5px] leading-[1.35]'
                : 'text-base-content/80 mb-0.5 block truncate text-[5.5px] leading-tight'
            }>
            {line}
          </span>
        ))}
        {variant === 'tile' && imageSrc ? (
          <img
            alt=""
            src={imageSrc}
            className="mt-1 mb-1.5 h-7 w-full object-cover"
            onError={() => setHideImage(true)}
          />
        ) : null}
        {variant === 'tile' && list.length > 0 ? (
          <ul className="text-base-content/80 mb-1.5 list-disc pl-2.5 text-[7.5px] leading-[1.35]">
            {list.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : null}
        {variant === 'tile' ? (
          <span
            aria-hidden
            className="from-base-100 pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t to-transparent"
          />
        ) : null}
      </>
    ) : null

  if (variant === 'row') {
    return (
      <span
        aria-hidden
        className="border-base-300 bg-base-100 relative size-10 shrink-0 overflow-hidden rounded-[2px] border px-1 pt-1">
        {body}
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className="border-base-300 bg-base-100 relative h-full w-full overflow-hidden rounded-t-[2px] border border-b-0 px-3 pt-2.5">
      {body}
    </span>
  )
}

export default DocumentPreviewPaper
