/**
 * Supabase API Response Validation Schemas
 *
 * These schemas validate responses from Supabase REST API calls
 * to ensure type safety when consuming external API data.
 */

import { z } from 'zod'

// =============================================================================
// User Response Schemas
// =============================================================================

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

// =============================================================================
// Workspace Response Schemas
// =============================================================================

export const supabaseWorkspaceSchema = z.object({
  id: z.string(),
  slug: z.string().optional(),
  name: z.string().nullable().optional()
})

export const supabaseWorkspacesArraySchema = z.array(supabaseWorkspaceSchema)

export type SupabaseWorkspace = z.infer<typeof supabaseWorkspaceSchema>

// =============================================================================
// Workspace Member Response Schemas
// =============================================================================

export const supabaseWorkspaceMemberSchema = z.object({
  workspace_id: z.string()
})

export const supabaseWorkspaceMembersArraySchema = z.array(supabaseWorkspaceMemberSchema)

export type SupabaseWorkspaceMember = z.infer<typeof supabaseWorkspaceMemberSchema>

// =============================================================================
// Channel Response Schemas
// =============================================================================

export const supabaseChannelSchema = z.object({
  id: z.string()
})

export const supabaseChannelsArraySchema = z.array(supabaseChannelSchema)

export type SupabaseChannel = z.infer<typeof supabaseChannelSchema>

// =============================================================================
// Generic Response Helpers
// =============================================================================

/**
 * Safely parse a Supabase API response with validation.
 * Returns null if the response is not a valid array or parsing fails.
 */
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

/**
 * Helper to safely parse a single Supabase object response.
 */
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
