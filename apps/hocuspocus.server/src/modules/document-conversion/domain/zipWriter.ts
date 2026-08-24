import { crc32, deflateRawSync } from 'node:zlib'

interface ZipEntry {
  name: string
  data: Uint8Array | string
  /** ODF requires the `mimetype` part uncompressed so readers can sniff it from the raw bytes. */
  store?: boolean
}

const LOCAL_SIGNATURE = 0x04034b50
const CENTRAL_SIGNATURE = 0x02014b50
const EOCD_SIGNATURE = 0x06054b50
const VERSION = 20

// 1980-01-01, the DOS epoch: a fixed stamp keeps two exports of the same
// document byte-identical, which a real clock would not.
const DOS_TIME = 0x0000
const DOS_DATE = 0x0021

const LOCAL_HEADER_BYTES = 30
const CENTRAL_HEADER_BYTES = 46
const EOCD_BYTES = 22

/**
 * Stored and raw deflate only. No ZIP64, no data descriptors: sizes are known
 * before the header is written because every part is already in memory.
 */
export const createZip = (entries: ZipEntry[]): Buffer => {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    // Byte length, never string length: a multi-byte name or body would
    // otherwise write a size and CRC that disagree with the payload.
    const source =
      typeof entry.data === 'string' ? Buffer.from(entry.data, 'utf8') : Buffer.from(entry.data)
    const body = entry.store ? source : deflateRawSync(source)
    const method = entry.store ? 0 : 8
    const checksum = crc32(source)

    const local = Buffer.alloc(LOCAL_HEADER_BYTES)
    local.writeUInt32LE(LOCAL_SIGNATURE, 0)
    local.writeUInt16LE(VERSION, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(source.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, name, body)

    const directory = Buffer.alloc(CENTRAL_HEADER_BYTES)
    directory.writeUInt32LE(CENTRAL_SIGNATURE, 0)
    directory.writeUInt16LE(VERSION, 4)
    directory.writeUInt16LE(VERSION, 6)
    directory.writeUInt16LE(0, 8)
    directory.writeUInt16LE(method, 10)
    directory.writeUInt16LE(DOS_TIME, 12)
    directory.writeUInt16LE(DOS_DATE, 14)
    directory.writeUInt32LE(checksum, 16)
    directory.writeUInt32LE(body.length, 20)
    directory.writeUInt32LE(source.length, 24)
    directory.writeUInt16LE(name.length, 28)
    directory.writeUInt16LE(0, 30)
    directory.writeUInt16LE(0, 32)
    directory.writeUInt16LE(0, 34)
    directory.writeUInt16LE(0, 36)
    directory.writeUInt32LE(0, 38)
    directory.writeUInt32LE(offset, 42)
    central.push(directory, name)

    offset += LOCAL_HEADER_BYTES + name.length + body.length
  }

  const directorySize = central.reduce((total, part) => total + part.length, 0)
  const end = Buffer.alloc(EOCD_BYTES)
  end.writeUInt32LE(EOCD_SIGNATURE, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directorySize, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...locals, ...central, end])
}
