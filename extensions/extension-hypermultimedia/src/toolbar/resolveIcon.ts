import { getKitStorage } from '../kitStorage'
import * as Icons from '../utils/icons'
import { getCurrentMediaPlacement, type MediaPlacementId } from '../utils/media-placement'
import type { MediaActionContext } from './types'

type BuiltinIconKey =
  | 'caption'
  | 'view-original'
  | 'download'
  | 'replace'
  | 'copy'
  | 'delete'
  | 'more'

type PlacementIconKey = `align:${MediaPlacementId}`

/** A built-in slot, an `align:<placement>` slot, or a custom action id from `mediaActions`. */
export type MediaToolbarIconKey = BuiltinIconKey | PlacementIconKey | (string & {})

/** Everything a host needs to pick an icon — the key encodes the dynamic part. */
export interface MediaToolbarIconContext {
  key: MediaToolbarIconKey
  nodeType: string
}

/** Host hook: return SVG markup for a slot, or nullish to keep the built-in icon. */
export type MediaToolbarIconsResolver = (ctx: MediaToolbarIconContext) => string | null | undefined

export type MediaToolbarIconScope = Pick<MediaActionContext, 'editor' | 'nodeType'> & {
  /** Required for the inline align button (`align:<placement>`). */
  attrs?: Record<string, unknown>
}

const ICON_SIZE = 18

const ALIGN_MATERIAL: Record<MediaPlacementId, keyof typeof Icons> = {
  inline: 'AlignLeft',
  center: 'AlignCenter',
  right: 'AlignRight',
  'float-left': 'ImageLeft',
  'float-right': 'ImageRight'
}

const BUILTIN_MATERIAL: Record<BuiltinIconKey, () => string> = {
  caption: () => Icons.Caption({ size: ICON_SIZE }),
  'view-original': () => Icons.ExternalLink({ size: ICON_SIZE }),
  download: () => Icons.Download({ size: ICON_SIZE }),
  replace: () => Icons.Replace({ size: ICON_SIZE }),
  copy: () => Icons.Copy({ size: ICON_SIZE }),
  delete: () => Icons.Trash({ size: ICON_SIZE }),
  more: () => Icons.More({ size: ICON_SIZE })
}

function materialPlacementIcon(key: PlacementIconKey): string | null {
  const id = key.slice('align:'.length) as MediaPlacementId
  const icon = ALIGN_MATERIAL[id]
  return icon ? Icons[icon]({ size: ICON_SIZE }) : null
}

function normalizeIconKey(
  key: MediaToolbarIconKey,
  attrs?: Record<string, unknown>
): MediaToolbarIconKey {
  if (key === 'align' && attrs) {
    return `align:${getCurrentMediaPlacement(attrs)}`
  }
  return key
}

function defaultMaterialIcon(key: MediaToolbarIconKey): string | null {
  if (key.startsWith('align:')) return materialPlacementIcon(key as PlacementIconKey)
  if (key in BUILTIN_MATERIAL) return BUILTIN_MATERIAL[key as BuiltinIconKey]()
  return null
}

/** Host override → built-in Material icon → null (text button or host-only custom id). */
export function resolveMediaToolbarIcon(
  scope: MediaToolbarIconScope,
  key: MediaToolbarIconKey,
  icons?: MediaToolbarIconsResolver | null
): string | null {
  const resolvedKey = normalizeIconKey(key, scope.attrs)
  const iconCtx = { key: resolvedKey, nodeType: scope.nodeType }
  const override = (icons ?? getKitStorage(scope.editor).mediaToolbarIcons)?.(iconCtx)
  if (override) return override
  return defaultMaterialIcon(resolvedKey)
}
