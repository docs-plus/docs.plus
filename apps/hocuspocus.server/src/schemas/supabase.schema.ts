import { z } from 'zod'

export const supabaseUserSchema = z.object({
  id: z.string(),
  username: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  avatar_updated_at: z.string().nullable().optional(),
  display_name: z.string().nullable().optional()
})

export const supabaseUsersArraySchema = z.array(supabaseUserSchema)

export type SupabaseUser = z.infer<typeof supabaseUserSchema>

export const supabaseWorkspaceSchema = z.object({
  id: z.string(),
  slug: z.string().optional(),
  name: z.string().nullable().optional()
})

export const supabaseWorkspacesArraySchema = z.array(supabaseWorkspaceSchema)

export type SupabaseWorkspace = z.infer<typeof supabaseWorkspaceSchema>

export const supabaseWorkspaceMemberSchema = z.object({
  workspace_id: z.string()
})

export const supabaseWorkspaceMembersArraySchema = z.array(supabaseWorkspaceMemberSchema)

export type SupabaseWorkspaceMember = z.infer<typeof supabaseWorkspaceMemberSchema>

export const supabaseChannelSchema = z.object({
  id: z.string()
})

export const supabaseChannelsArraySchema = z.array(supabaseChannelSchema)

export type SupabaseChannel = z.infer<typeof supabaseChannelSchema>

export function parseSupabaseArray<T>(
  schema: z.ZodSchema<T[]>,
  data: unknown,
  logger?: { warn: (obj: object, msg: string) => void }
): T[] | null {
  const result = schema.safeParse(data)
  if (!result.success) {
    if (logger) {
      logger.warn({ error: result.error.format(), data }, 'Invalid Supabase API response')
    }
    return null
  }
  return result.data
}

export function parseSupabaseObject<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  logger?: { warn: (obj: object, msg: string) => void }
): T | null {
  const result = schema.safeParse(data)
  if (!result.success) {
    if (logger) {
      logger.warn({ error: result.error.format(), data }, 'Invalid Supabase API response')
    }
    return null
  }
  return result.data
}
