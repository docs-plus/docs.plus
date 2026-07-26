import { UserProfileDialog } from '@components/ui/dialogs/UserProfileDialog'
import { userProfileDialogOpenConfig } from '@components/ui/dialogs/userProfileDialogOpenConfig'
import { Tooltip } from '@components/ui/Tooltip'
import Config from '@config'
import { lorelei } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
import { Placement } from '@floating-ui/react'
import { useStore } from '@stores'
import { type FaceSource, resolveFace } from '@utils/avatarFace'
import {
  type AvatarEdge,
  avatarEdgeClass,
  type AvatarSize,
  SIZE_CLASSES
} from '@utils/avatarStackGeometry'
import { forwardRef, type Ref, useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

/** Which candidate the `<img>` points at; steps forward on load failure. */
type AvatarImageSource = 'bucket' | 'remote' | 'fallback'

const FALLBACK_SEED = 'avatar'

const createFallbackAvatarUri = (seed: string): string => {
  const svg = createAvatar(lorelei, { seed, backgroundType: ['solid'] }).toString()
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** The one identity input — profile, RPC row, or caret shape (`utils/avatarFace`). */
  face?: FaceSource | null
  /** Overrides the display name resolved from `face`. */
  alt?: string | null
  size?: AvatarSize
  /** Default `ring`. Stacks pass `paper`/`well`; gallery uses `none`. */
  edge?: AvatarEdge
  /** Opt-in presence dot; omit to render none. */
  presence?: 'online' | 'offline'
  isTyping?: boolean
  /** Renders a button that opens the profile dialog. Needs a `face` id to activate. */
  clickable?: boolean
  tooltip?: string
  tooltipPlacement?: Placement
}

export const Avatar = forwardRef<HTMLElement, AvatarProps>(function Avatar(
  {
    face,
    alt,
    size = 'md',
    edge = 'ring',
    presence,
    isTyping = false,
    clickable = true,
    tooltip,
    tooltipPlacement,
    className,
    ...restProps
  },
  ref
) {
  const openDialog = useStore((state) => state.openDialog)
  const [imageSource, setImageSource] = useState<AvatarImageSource>('bucket')

  const { id, src, avatarUpdatedAt, displayName } = resolveFace(face)
  const label = alt ?? displayName ?? 'User avatar'

  const bucketSrc = useMemo(() => {
    if (!id || !avatarUpdatedAt || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null
    return Config.app.profile.getAvatarURL(id, String(avatarUpdatedAt))
  }, [id, avatarUpdatedAt])

  const remoteSrc = src?.trim() || null

  useEffect(() => {
    setImageSource('bucket')
  }, [id, bucketSrc, remoteSrc])

  // DiceBear only runs once no real photo is available, so avatars with a
  // bucket or OAuth image never pay for a generated SVG they discard.
  const imgSrc = useMemo(() => {
    if (imageSource === 'bucket' && bucketSrc) return bucketSrc
    if (imageSource !== 'fallback' && remoteSrc) return remoteSrc
    return createFallbackAvatarUri(id || alt || displayName || FALLBACK_SEED)
  }, [imageSource, bucketSrc, remoteSrc, id, alt, displayName])

  const handleError = useCallback(() => {
    setImageSource((current) =>
      current === 'bucket' && bucketSrc && remoteSrc && remoteSrc !== bucketSrc
        ? 'remote'
        : 'fallback'
    )
  }, [bucketSrc, remoteSrc])

  const interactive = clickable && Boolean(id)

  const openProfile = useCallback(() => {
    if (!id) return
    openDialog(<UserProfileDialog userId={id} />, userProfileDialogOpenConfig)
  }, [id, openDialog])

  const rootClassName = twMerge(
    'avatar rounded-full bg-base-200',
    SIZE_CLASSES[size],
    avatarEdgeClass(edge),
    // daisyUI clips `.avatar`; the presence dot and stack cutout paint outside the circle.
    '!overflow-visible',
    presence && (presence === 'online' ? 'avatar-online' : 'avatar-offline'),
    isTyping && 'avatar-typing',
    interactive
      ? 'focus-visible:ring-primary cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none'
      : 'cursor-default',
    className
  )

  const image = (
    <img
      alt={label}
      src={imgSrc}
      onError={handleError}
      className={twMerge(
        'size-full rounded-full object-cover',
        edge === 'ring' &&
          'shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--color-base-content)_6%,transparent)]'
      )}
    />
  )

  const root = interactive ? (
    <button
      {...restProps}
      ref={ref as Ref<HTMLButtonElement>}
      type="button"
      aria-label={displayName ? `Open ${displayName}'s profile` : 'Open profile'}
      onClick={openProfile}
      className={rootClassName}>
      {image}
    </button>
  ) : (
    <div {...restProps} ref={ref as Ref<HTMLDivElement>} className={rootClassName}>
      {image}
    </div>
  )

  if (!tooltip) return root

  return (
    <Tooltip title={tooltip} placement={tooltipPlacement}>
      {root}
    </Tooltip>
  )
})
