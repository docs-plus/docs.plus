import { Icons } from '@components/icons/registry'
import { twMerge } from '@utils/twMerge'
import { useRef, useState } from 'react'
import type { IconType } from 'react-icons'

import { Band, HovercardFacts, HovercardTitle } from './HovercardParts'
import type { LinkFactIcon, WebCardData } from './types'

const FACT_ICON: Record<LinkFactIcon, IconType> = {
  location: Icons.mapPin,
  work: Icons.work,
  posted: Icons.calendar,
  updated: Icons.calendar,
  stars: Icons.star,
  language: Icons.code,
  answers: Icons.thread,
  accepted: Icons.accepted
}

/**
 * The page picture: a 1.91:1 cover, or a 40px owner tile for a repo. It fades in on load.
 * A failure folds a cover away and fades a tile in place, so the text beside it stays.
 */
function Picture({ url, tile }: { url: string; tile: boolean }) {
  const wellRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

  const fail = () => {
    const well = wellRef.current
    if (!tile && well) {
      well.style.height = `${well.offsetHeight}px`
      void well.offsetHeight
      well.style.height = '0px'
    }
    setState('failed')
  }

  return (
    <div
      ref={wellRef}
      className={twMerge(
        'bg-base-200 overflow-hidden motion-safe:transition-[height,opacity] motion-safe:duration-[var(--motion-panel)] motion-safe:ease-[var(--motion-ease-exit)]',
        tile
          ? 'rounded-field border-base-300 size-10 border'
          : 'border-base-300 aspect-[1.91/1] border-b',
        state === 'failed' && 'opacity-0',
        state === 'failed' && !tile && 'border-b-0'
      )}>
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        decoding="async"
        onLoad={() => setState('ready')}
        onError={fail}
        className={twMerge(
          'block size-full object-cover motion-safe:transition-opacity motion-safe:duration-[var(--motion-panel)] motion-safe:ease-[var(--motion-ease-enter)]',
          state !== 'ready' && 'opacity-0'
        )}
      />
    </div>
  )
}

type Props = {
  href: string
  data: WebCardData
  /** `newTab` is true for Mod-click and a middle click. */
  onOpen: (newTab: boolean) => void
}

/** The docs.plus card body for a web page: picture, title, facts and description. */
export function WebLinkCard({ href, data, onOpen }: Props) {
  const { title, description, image, facts } = data
  const tile = !!image && data.kind === 'repo'

  return (
    <div className={twMerge(tile && 'grid grid-cols-[40px_minmax(0,1fr)] items-start gap-x-3 p-3')}>
      {image && <Picture url={image.url} tile={tile} />}
      <Band className={twMerge(tile && 'p-0')}>
        <HovercardTitle href={href} onOpen={onOpen}>
          {title}
        </HovercardTitle>
        {facts && (
          <HovercardFacts
            className="mt-1"
            facts={facts.map(({ icon, text }) => ({ Icon: FACT_ICON[icon], text }))}
          />
        )}
        {description && (
          <p className="text-meta text-base-content/70 line-clamp-2">{description}</p>
        )}
      </Band>
    </div>
  )
}
