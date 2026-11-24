import { describe, expect, test } from 'bun:test'

import { Prisma, type PrismaClient } from '../../../../generated/prisma/client'
import { AppError, ValidationError } from '../../../../lib/errors'
import type { TiptapDocJson } from '../../types'
import { createDocumentWithContent, type WriteAccessMirror } from '../../infra/contentStore'

const validContent: TiptapDocJson = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }
  ]
}

const makePrismaRecorder = (opts: { collideFirst?: boolean } = {}) => {
  const events: string[] = []
  const metadataCreates: Array<Record<string, unknown>> = []
  let txCount = 0

  const prisma = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      txCount += 1
      events.push(`tx:${txCount}`)
      if (opts.collideFirst && txCount === 1) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { driverAdapterError: { cause: { constraint: { fields: ['slug'] } } } }
        })
      }
      const tx = {
        documentMetadata: {
          create: async (arg: { data: Record<string, unknown> }) => {
            metadataCreates.push(arg.data)
            return { ...arg.data, createdAt: new Date() }
          }
        },
        documents: {
          create: async (arg: { data: Record<string, unknown> }) => arg.data
        }
      }
      return fn(tx)
    }
  } as unknown as PrismaClient

  return { prisma, events, metadataCreates }
}

describe('createDocumentWithContent', () => {
  test('skips the access mirror and sets isPrivate false for public documents', async () => {
    const { prisma, metadataCreates } = makePrismaRecorder()
    let mirrorCalls = 0
    const mirror: WriteAccessMirror = async () => {
      mirrorCalls += 1
    }

    const outcome = await createDocumentWithContent(prisma, {
      slug: 'public-doc',
      content: validContent,
      ownerId: 'user-1',
      writeAccessMirror: mirror
    })

    expect(outcome.status).toBe('created')
    expect(mirrorCalls).toBe(0)
    expect(metadataCreates).toHaveLength(1)
    expect(metadataCreates[0]?.isPrivate).toBe(false)
  })

  test('refuses isPrivate without an owner using ValidationError before mirror or database writes', async () => {
    const { prisma, metadataCreates } = makePrismaRecorder()
    let mirrorCalls = 0
    const mirror: WriteAccessMirror = async () => {
      mirrorCalls += 1
    }

    await expect(
      createDocumentWithContent(prisma, {
        slug: 'no-owner',
        content: validContent,
        ownerId: null,
        isPrivate: true,
        writeAccessMirror: mirror
      })
    ).rejects.toBeInstanceOf(ValidationError)

    expect(mirrorCalls).toBe(0)
    expect(metadataCreates).toHaveLength(0)
  })

  test('returns invalid-content before writing the access mirror or database rows', async () => {
    const { prisma, metadataCreates } = makePrismaRecorder()
    let mirrorCalls = 0
    const mirror: WriteAccessMirror = async () => {
      mirrorCalls += 1
    }

    const outcome = await createDocumentWithContent(prisma, {
      slug: 'bad-doc',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'No H1' }] }]
      },
      ownerId: 'user-1',
      isPrivate: true,
      writeAccessMirror: mirror
    })

    expect(outcome.status).toBe('invalid-content')
    expect(mirrorCalls).toBe(0)
    expect(metadataCreates).toHaveLength(0)
  })

  test('writes the access mirror once before the transaction and sets isPrivate true across uniqueSlug retries', async () => {
    const { prisma, events, metadataCreates } = makePrismaRecorder({ collideFirst: true })
    const mirrorCalls: Array<{ documentId: string; isPrivate: boolean; ownerId: string | null }> =
      []
    const mirror: WriteAccessMirror = async (params) => {
      events.push('mirror')
      mirrorCalls.push(params)
    }

    const outcome = await createDocumentWithContent(prisma, {
      slug: 'private-doc',
      content: validContent,
      ownerId: 'user-1',
      isPrivate: true,
      uniqueSlug: true,
      writeAccessMirror: mirror
    })

    expect(outcome.status).toBe('created')
    expect(mirrorCalls).toHaveLength(1)
    expect(mirrorCalls[0]).toEqual({
      documentId: metadataCreates[0]?.documentId as string,
      isPrivate: true,
      ownerId: 'user-1'
    })
    expect(events).toEqual(['mirror', 'tx:1', 'tx:2'])
    expect(metadataCreates[0]?.isPrivate).toBe(true)
  })

  test('rethrows 503 AppError from the access mirror without wrapping it as DatabaseError or writing rows', async () => {
    const { prisma, metadataCreates } = makePrismaRecorder()
    const mirror: WriteAccessMirror = async () => {
      throw new AppError('Document access could not be saved', 503, 'SERVICE_UNAVAILABLE')
    }

    let caught: unknown
    try {
      await createDocumentWithContent(prisma, {
        slug: 'mirror-down',
        content: validContent,
        ownerId: 'user-1',
        isPrivate: true,
        writeAccessMirror: mirror
      })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(AppError)
    expect((caught as AppError).statusCode).toBe(503)
    expect((caught as AppError).code).toBe('SERVICE_UNAVAILABLE')
    expect(metadataCreates).toHaveLength(0)
  })
})
