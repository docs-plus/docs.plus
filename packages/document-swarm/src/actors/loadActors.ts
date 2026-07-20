import type { ActorRecord } from '../types.ts'

/** Reads the actors file, returning null when it does not exist yet (so provision can grow it). */
export async function readActorsFile(actorsFile: string): Promise<ActorRecord[] | null> {
  const file = Bun.file(actorsFile)
  if (!(await file.exists())) return null

  const parsed: unknown = JSON.parse(await file.text())
  if (!Array.isArray(parsed)) {
    throw new Error(
      `Actors file "${actorsFile}" is malformed: expected a JSON array of Swarm Actor records.`
    )
  }
  return parsed as ActorRecord[]
}

/** Loads the first `count` Swarm Actors for a run; errors if the file is missing or the pool is too small. */
export async function loadActors(actorsFile: string, count: number): Promise<ActorRecord[]> {
  const actors = await readActorsFile(actorsFile)
  if (!actors) {
    throw new Error(
      `Actors file "${actorsFile}" not found. Provision first: ` +
        `bun run --filter @docs.plus/document-swarm provision --count ${count}`
    )
  }
  if (actors.length < count) {
    throw new Error(
      `Actors file "${actorsFile}" holds ${actors.length} Swarm Actor(s) but ${count} were requested. ` +
        `Grow the pool: bun run --filter @docs.plus/document-swarm provision --count ${count}`
    )
  }
  return actors.slice(0, count)
}
