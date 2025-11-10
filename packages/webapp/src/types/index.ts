/**
 * Centralized type exports
 * All types should be imported from '@types'
 *
 * Organization:
 * - Database types from Supabase
 * - Domain types (business entities)
 * - API types (request/response)
 * - Editor types (TipTap)
 * - History types
 * - Store types
 */

// Database types (from Supabase schema)
export type { Database } from './supabase'
export * from './supabase'

// Domain types (business entities)
export * from './domain'

// API types (request/response)
export * from './api'

// Editor types (TipTap)
export * from './tiptap'

// History types
export * from './history'

// Store types
export type { TChannelSettings } from './stores'
