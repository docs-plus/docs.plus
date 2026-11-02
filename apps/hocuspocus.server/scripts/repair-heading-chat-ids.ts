/**
 * Points chat rooms orphaned by a re-keying replace back at their heading (#474).
 * Ruled for `/demo` only. Dry-run by default; `--apply` writes. Re-runnable.
 * Decodes every version row, so never run it inside a production container.
 * Run: bun --env-file=../../.env.local scripts/repair-heading-chat-ids.ts <documentId> [--apply]
 */
import { prisma } from '../src/lib/prisma'
import { getServiceRoleClient } from '../src/lib/supabase'
import { segmentSections } from '../src/modules/document-changes/domain/segmentSections'
import { readContent } from '../src/modules/document-content/domain/readContent'

const APPLY = process.argv.includes('--apply')
const documentId = process.argv.slice(2).find((arg) => !arg.startsWith('--'))

interface Room {
  id: string
  heading_id: string
  messages: number
}

type Action = 'move' | 'replace newer room' | 'skip'

interface PlanRow {
  oldHeadingId: string
  roomId: string
  heading: string
  currentTocId: string | null
  messages: number
  newerRoomId: string | null
  newerMessages: number
  action: Action
  reason: string
}

const headingKey = (level: number, text: string): string => `${level}|${text}`

// Rows are read oldest first, so a later row overwrites an id's level and text. Two
// replaces happened on `/demo`, so a room can sit two generations back.
const readHeadings = async (id: string) => {
  const rows = await prisma.documents.findMany({
    where: { documentId: id },
    orderBy: { version: 'asc' },
    select: { version: true, data: true }
  })
  const past = new Map<string, string>()
  let head = new Map<string, string[]>()
  for (const row of rows) {
    const read = readContent(row.data, 'json')
    if (!read.ok) throw new Error(`Version ${row.version} could not be decoded`)
    head = new Map()
    for (const section of segmentSections(read.content as Parameters<typeof segmentSections>[0])) {
      if (!section.tocId) continue
      const key = headingKey(section.level, section.headingText)
      past.set(section.tocId, key)
      head.set(key, [...(head.get(key) ?? []), section.tocId])
    }
  }
  return { past, head }
}

const readRooms = async (id: string): Promise<Room[]> => {
  const client = getServiceRoleClient()
  if (!client) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  const { data, error } = await client
    .from('channels')
    .select('id, heading_id')
    .eq('workspace_id', id)
  if (error) throw error
  const rooms: Room[] = []
  for (const room of data ?? []) {
    const { count, error: countError } = await client
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', room.id)
    if (countError) throw countError
    rooms.push({ ...room, messages: count ?? 0 })
  }
  return rooms
}

const plan = (
  id: string,
  { past, head }: Awaited<ReturnType<typeof readHeadings>>,
  rooms: Room[]
): PlanRow[] => {
  const current = new Set([...head.values()].flat())
  const roomByHeading = new Map(rooms.map((room) => [room.heading_id, room]))
  // The document channel carries the documentId as its heading_id.
  const orphans = rooms.filter(
    (room) => room.heading_id !== id && !current.has(room.heading_id) && room.messages > 0
  )
  const claims = new Map<string, number>()
  for (const room of orphans) {
    const ids = head.get(past.get(room.heading_id) ?? '')
    if (ids?.length === 1) claims.set(ids[0], (claims.get(ids[0]) ?? 0) + 1)
  }

  return orphans.map((room) => {
    const key = past.get(room.heading_id)
    const ids = key ? head.get(key) : undefined
    const row = {
      oldHeadingId: room.heading_id,
      roomId: room.id,
      heading: key ?? '(in no version)',
      messages: room.messages
    }
    const skip = (reason: string): PlanRow => ({
      ...row,
      currentTocId: null,
      newerRoomId: null,
      newerMessages: 0,
      action: 'skip',
      reason
    })
    if (!ids) return skip('no heading with this level and text in the head')
    if (ids.length > 1) return skip('this level and text appears more than once in the head')
    const [tocId] = ids
    if ((claims.get(tocId) ?? 0) > 1) return skip('more than one old room claims this heading')
    const newer = roomByHeading.get(tocId)
    return {
      ...row,
      currentTocId: tocId,
      newerRoomId: newer?.id ?? null,
      newerMessages: newer?.messages ?? 0,
      action: newer ? 'replace newer room' : 'move',
      reason: ''
    }
  })
}

// Ruling on #474: the old room always takes the heading, so the newer room is removed.
// Its messages cascade with it, which is why the table shows their count first. A stop
// between the two writes leaves the heading with no room, and a re-run then moves it.
const applyRow = async (row: PlanRow): Promise<void> => {
  const client = getServiceRoleClient()
  if (!client) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  if (row.newerRoomId) {
    const { error } = await client.from('channels').delete().eq('id', row.newerRoomId)
    if (error) throw error
  }
  const { error } = await client
    .from('channels')
    .update({ heading_id: row.currentTocId })
    .eq('id', row.roomId)
  if (error) throw error
}

const main = async (): Promise<void> => {
  if (!documentId) throw new Error('Pass a documentId')
  const rows = plan(documentId, await readHeadings(documentId), await readRooms(documentId))
  console.table(
    rows.map(({ roomId: _room, newerRoomId: _newer, ...row }) => row),
    ['oldHeadingId', 'heading', 'currentTocId', 'messages', 'newerMessages', 'action', 'reason']
  )
  if (!APPLY) {
    console.log(`Dry run: ${rows.length} orphaned rooms with messages. Nothing written.`)
    return
  }
  const writes = rows.filter((row) => row.action !== 'skip')
  for (const row of writes) await applyRow(row)
  console.log(`Applied ${writes.length} of ${rows.length} rows.`)
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
