export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

/** Solo Avatar + stack face edge (one knob — no frame/cutout + className fork). */
export type AvatarEdge = 'ring' | 'paper' | 'well' | 'none'

/** Stack public surface → Avatar `edge`. */
export type AvatarStackSurface = 'paper' | 'well' | 'outline'

/** Fixed edge as the stack grows: `right` pins the right edge (faces extend left), `left` the opposite. */
export type AvatarStackAnchor = 'left' | 'right'

export const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'size-6',
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
  xl: 'size-14',
  '2xl': 'size-16'
}

/** Negative overlap per size so faces read as one stack, not a gap. */
export const SPACING_CLASSES: Record<AvatarSize, string> = {
  xs: '-space-x-2',
  sm: '-space-x-3',
  md: '-space-x-4',
  lg: '-space-x-5',
  xl: '-space-x-6',
  '2xl': '-space-x-7'
}

export const TEXT_CLASSES: Record<AvatarSize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
  xl: 'text-base',
  '2xl': 'text-lg'
}

/**
 * Stack cutout color only — width is forced in `_daisyui.scss` because daisyUI’s
 * `.avatar-group .avatar { border: 4px solid … }` wins over Tailwind ring/border utilities.
 */
export function avatarEdgeClass(edge: AvatarEdge): string {
  switch (edge) {
    case 'ring':
      return '[--avatar-stack-edge:var(--color-base-300)] !ring-0'
    case 'paper':
      return '[--avatar-stack-edge:var(--color-base-100)] !ring-0'
    case 'well':
      return '[--avatar-stack-edge:var(--pad-well)] !ring-0'
    case 'none':
      return '!border-0 !ring-0'
    default: {
      const _exhaustive: never = edge
      return _exhaustive
    }
  }
}

export function stackSurfaceToEdge(surface: AvatarStackSurface): AvatarEdge {
  switch (surface) {
    case 'outline':
      return 'ring'
    case 'paper':
      return 'paper'
    case 'well':
      return 'well'
    default: {
      const _exhaustive: never = surface
      return _exhaustive
    }
  }
}
