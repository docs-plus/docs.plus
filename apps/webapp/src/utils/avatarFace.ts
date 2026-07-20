/** Loose profile / RPC / caret shapes — snake_case preferred, camelCase accepted. */
export type FaceSource = {
  id?: string
  user_id?: string
  avatar_url?: string | null
  avatar_updated_at?: string | number | null
  avatarUrl?: string | null
  avatarUpdatedAt?: string | number | null
  display_name?: string | null
  full_name?: string | null
  username?: string | null
  email?: string | null
  status?: string | null
}

export type ResolvedFace = {
  id?: string
  src?: string | null
  avatarUpdatedAt?: string | number | null
  alt?: string
  displayName?: string
}

/** Stack row after face normalization (coalesced display_name). */
export type StackUser = {
  id?: string
  avatar_url?: string | null
  avatar_updated_at?: string | number | null
  display_name?: string | null
  status?: string | null
}

export function resolveDisplayName(source: FaceSource | null | undefined): string | undefined {
  if (!source) return undefined
  return source.display_name ?? source.full_name ?? source.username ?? undefined
}

/** Normalize avatar inputs for `<Avatar>` — bucket/OAuth/DiceBear stay in Avatar. */
export function resolveFace(source: FaceSource | null | undefined): ResolvedFace {
  if (!source) return {}

  const id = source.id ?? source.user_id
  const src = source.avatar_url ?? source.avatarUrl ?? null
  const avatarUpdatedAt = source.avatar_updated_at ?? source.avatarUpdatedAt ?? null
  const displayName = resolveDisplayName(source)

  return {
    id,
    src,
    avatarUpdatedAt,
    alt: displayName,
    displayName
  }
}

/** Boundary adapter for id aliases (`member_id` / camel) → stack rows. */
export function toStackUser(source: FaceSource | null | undefined): StackUser {
  const face = resolveFace(source)
  return {
    id: face.id,
    avatar_url: face.src ?? null,
    avatar_updated_at: face.avatarUpdatedAt ?? null,
    display_name: face.displayName ?? null,
    status: source?.status ?? null
  }
}
