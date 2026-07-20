import {
  avatarEdgeClass,
  type AvatarSize,
  type AvatarStackSurface,
  SIZE_CLASSES,
  SPACING_CLASSES,
  stackSurfaceToEdge
} from '@utils/avatarStackGeometry'
import { twMerge } from 'tailwind-merge'

interface AvatarStackLoaderProps {
  className?: string
  size?: AvatarSize
  surface?: AvatarStackSurface
  repeat?: number
}

/** Skeleton faces that mirror AvatarStack overlap + surface edge. */
const AvatarStackLoader = ({
  className = '',
  size = 'md',
  surface = 'paper',
  repeat = 2
}: AvatarStackLoaderProps) => {
  const sizeClass = SIZE_CLASSES[size]
  const spacingClass = SPACING_CLASSES[size]
  const edgeClass = avatarEdgeClass(stackSurfaceToEdge(surface))

  return (
    <div className={twMerge('avatar-group', spacingClass, className)}>
      {Array.from({ length: repeat }).map((_, index) => (
        <div className="avatar" key={index}>
          <div className={twMerge(sizeClass, 'skeleton rounded-full', edgeClass)} />
        </div>
      ))}
    </div>
  )
}

export default AvatarStackLoader
