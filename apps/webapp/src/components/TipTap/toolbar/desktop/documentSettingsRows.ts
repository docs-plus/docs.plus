import type { FaceSource } from '@utils/avatarFace'

type DocumentSettingsRowsArgs = {
  userId?: string
  isAuthServiceAvailable?: boolean
  metadata: {
    isPrivate?: boolean
    readOnly?: boolean
    ownerId?: string
    ownerProfile?: FaceSource & { default_avatar_url?: string | null }
  }
}

/** Which soft-well rows the panel shows. Its chunk loader reads the same answer. */
export function documentSettingsRows({
  userId,
  isAuthServiceAvailable,
  metadata
}: DocumentSettingsRowsArgs) {
  const isPrivate = Boolean(metadata.isPrivate)
  const readOnly = Boolean(metadata.readOnly)
  const isOwner = Boolean(userId && userId === metadata.ownerId)
  // Hide Follow when nobody else can edit. The owner of a private or read-only pad is
  // that case. A visitor still follows, because the owner can edit.
  const showFollow =
    Boolean(isAuthServiceAvailable && userId) && (!isOwner || (!isPrivate && !readOnly))
  return {
    isPrivate,
    readOnly,
    canManageAccess: isOwner && Boolean(isAuthServiceAvailable),
    showFollow,
    identity: isAuthServiceAvailable ? metadata.ownerProfile : undefined
  }
}

export type DocumentSettingsRows = ReturnType<typeof documentSettingsRows>
