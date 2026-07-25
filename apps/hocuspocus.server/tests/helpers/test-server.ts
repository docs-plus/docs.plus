import type { PrismaClient } from '@prisma/client'
import { Hono } from 'hono'

/**
 * Test server helper for API testing
 */
export class TestServer {
  public app: Hono
  private baseURL: string

  constructor(app: Hono, port: number = 3001) {
    this.app = app
    this.baseURL = `http://localhost:${port}`
  }

  /**
   * Make a GET request
   */
  async get(path: string, headers: Record<string, string> = {}) {
    const response = await this.app.request(`${this.baseURL}${path}`, {
      method: 'GET',
      headers
    })
    return {
      status: response.status,
      headers: response.headers,
      json: async (): Promise<any> => response.json(),
      text: async () => response.text()
    }
  }

  /**
   * Make a POST request
   */
  async post(path: string, body: any, headers: Record<string, string> = {}) {
    const response = await this.app.request(`${this.baseURL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    })
    return {
      status: response.status,
      headers: response.headers,
      json: async (): Promise<any> => response.json(),
      text: async () => response.text()
    }
  }

  /**
   * Make a PUT request
   */
  async put(path: string, body: any, headers: Record<string, string> = {}) {
    const response = await this.app.request(`${this.baseURL}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    })
    return {
      status: response.status,
      headers: response.headers,
      json: async (): Promise<any> => response.json(),
      text: async () => response.text()
    }
  }

  /**
   * Make a PATCH request
   */
  async patch(path: string, body: any, headers: Record<string, string> = {}) {
    const response = await this.app.request(`${this.baseURL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    })
    return {
      status: response.status,
      headers: response.headers,
      json: async (): Promise<any> => response.json(),
      text: async () => response.text()
    }
  }

  /**
   * Make a DELETE request
   */
  async delete(path: string, headers: Record<string, string> = {}) {
    const response = await this.app.request(`${this.baseURL}${path}`, {
      method: 'DELETE',
      headers
    })
    return {
      status: response.status,
      headers: response.headers,
      json: async (): Promise<any> => response.json(),
      text: async () => response.text()
    }
  }

  /**
   * Upload a file
   */
  async upload(path: string, file: File, fieldName: string = 'mediaFile') {
    const formData = new FormData()
    formData.append(fieldName, file)

    const response = await this.app.request(`${this.baseURL}${path}`, {
      method: 'POST',
      body: formData
    })
    return {
      status: response.status,
      headers: response.headers,
      json: async (): Promise<any> => response.json(),
      text: async () => response.text()
    }
  }
}

/**
 * Create a mock Prisma client for testing
 */
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
    documents: {
      findFirst: async () => null,
      findUnique: async () => null,
      findMany: async () => [],
      create: async (data: any) => ({ id: 1, ...data.data }),
      count: async () => 0
    },
    $queryRaw: async () => [{ result: 1 }],
    $disconnect: async () => {}
  }

  // The interactive form hands the callback this same client, so a test that
  // overrides `mockPrisma.documents.create` observes writes made inside a
  // transaction too.
  client.$transaction = async (arg: any) =>
    typeof arg === 'function' ? arg(client) : Promise.all(arg)

  return client as Partial<PrismaClient>
}

/**
 * Create a mock Redis client for testing
 */
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
