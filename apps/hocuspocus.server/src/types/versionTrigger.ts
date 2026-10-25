// No imports: the webapp type-imports this file across the app boundary.

// Rows the server mints for itself: the pre-restore safety copy and the
// one-time schema rebuild. They carry a name, so retention can only tell them
// from a checkpoint a person chose by reading this (see pruneAutosaveVersions).
export const MACHINE_VERSION_TRIGGERS = ['revert-backup', 'schema-migration'] as const
export type MachineVersionTrigger = (typeof MACHINE_VERSION_TRIGGERS)[number]

// Provenance stamped on a Documents row. Live collaborative saves are
// 'websocket'; the rest are one-shot operations that ride the connection
// context of the caller that opened the direct connection.
export type VersionTrigger =
  'websocket' | 'api' | 'mcp' | 'checkpoint' | 'revert' | MachineVersionTrigger
