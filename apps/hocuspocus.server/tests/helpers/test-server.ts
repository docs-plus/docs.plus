import { mkdtemp, rm } from 'fs/promises'
import { Hono } from 'hono'
import os from 'os'
import path from 'path'

import { config } from '../../src/config/env'
import type { PrismaClient } from '../../src/generated/prisma/client'

// bun test shares one process and one token cache, so every file that stubs
// getUser must map a shared token to the same user. Keep the map here only.
export const TEST_TOKEN_USERS: Record<string, string> = {
  'valid-test-token': 'user-123',
  'other-user-token': 'user-456'
}

/** Stand-in for `getAnonClient().auth.getUser`. `extra` adds file-only tokens. */
export const stubGetUser = async (token: string, extra: Record<string, string> = {}) => {
  const id = extra[token] ?? TEST_TOKEN_USERS[token]
  if (id) {
    return {
      data: { user: { id, email: `${id}@example.com`, is_anonymous: false, user_metadata: {} } },
      error: null
    }
  }
  return { data: { user: null }, error: { status: 401, message: 'invalid' } }
}

/** Points the local media store at a fresh temp dir. `restore` undoes it all. */
export const useTempLocalStore = async (prefix: string) => {
  const localStore = config.storage.local as { enabled: boolean }
  const originalEnabled = localStore.enabled
  const originalPath = process.env.LOCAL_STORAGE_PATH
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix))
  process.env.LOCAL_STORAGE_PATH = dir
  localStore.enabled = true
  const restore = async () => {
    localStore.enabled = originalEnabled
    if (originalPath === undefined) delete process.env.LOCAL_STORAGE_PATH
    else process.env.LOCAL_STORAGE_PATH = originalPath
    await rm(dir, { recursive: true, force: true })
  }
  return { dir, restore }
}

export class TestServer {
  public app: Hono
  private baseURL: string

  constructor(app: Hono, port: number = 3001) {
    this.app = app
    this.baseURL = `http://localhost:${port}`
  }

  private async send(
    method: string,
    path: string,
    init: { body?: RequestInit['body']; headers?: Record<string, string> } = {}
  ) {
    const response = await this.app.request(`${this.baseURL}${path}`, { method, ...init })
    return {
      status: response.status,
      headers: response.headers,
      json: async (): Promise<any> => response.json(),
      text: async () => response.text()
    }
  }

  async get(path: string, headers: Record<string, string> = {}) {
    return this.send('GET', path, { headers })
  }

  async post(path: string, body: any, headers: Record<string, string> = {}) {
    return this.send('POST', path, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...headers }
    })
  }

  async put(path: string, body: any, headers: Record<string, string> = {}) {
    return this.send('PUT', path, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...headers }
    })
  }

  async patch(path: string, body: any, headers: Record<string, string> = {}) {
    return this.send('PATCH', path, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...headers }
    })
  }

  async delete(path: string, headers: Record<string, string> = {}) {
    return this.send('DELETE', path, { headers })
  }

  async upload(
    path: string,
    file: File,
    fieldName: string = 'mediaFile',
    headers: Record<string, string> = {}
  ) {
    const formData = new FormData()
    formData.append(fieldName, file)
    return this.send('POST', path, { body: formData, headers })
  }
}

export const createMockPrisma = (): Partial<PrismaClient> => {
  const client: any = {
    documentMetadata: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async (data: any) => ({ id: 1, ...data.data }),
      upsert: async (data: any) => ({ id: 1, ...data.create }),
      update: async (data: any) => ({ id: 1, ...data.data }),
      delete: async () => ({ id: 1 }),
      count: async () => 0
    },
    documentFavorite: {
      upsert: async (data: any) => ({ ...data.create }),
      deleteMany: async () => ({ count: 0 })
    },
    documents: {
      findFirst: async () => null,
      findUnique: async () => null,
      findMany: async () => [],
      create: async (data: any) => ({ id: 1, ...data.data }),
      count: async () => 0
    },
    // No row => epoch 1, the same default a slug that has never been purged gets.
    documentSlugEpoch: {
      findUnique: async () => null,
      upsert: async (data: any) => ({ ...data.create })
    },
    documentPurgeTombstone: {
      findUnique: async () => null
    },
    $queryRaw: async () => [{ result: 1 }],
    $executeRaw: async () => 0,
    $disconnect: async () => {}
  }

  // The interactive form hands the callback this same client, so a test that
  // overrides `mockPrisma.documents.create` observes writes made inside a
  // transaction too.
  client.$transaction = async (arg: any) =>
    typeof arg === 'function' ? arg(client) : Promise.all(arg)

  return client as Partial<PrismaClient>
}

export const createMockRedis = (): any => {
  const store = new Map<string, string>()
  return {
    incr: async (key: string) => {
      const val = parseInt(store.get(key) || '0', 10) + 1
      store.set(key, val.toString())
      return val
    },
    pexpire: async () => 1,
    pttl: async () => 900000,
    ping: async () => 'PONG',
    quit: async () => 'OK',
    get: async (key: string) => store.get(key) || null,
    set: async (key: string, value: string) => {
      store.set(key, value)
      return 'OK'
    },
    del: async (key: string) => {
      store.delete(key)
      return 1
    }
  }
}
