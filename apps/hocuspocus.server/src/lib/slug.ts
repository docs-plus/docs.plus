import { Prisma } from '@prisma/client'

// Runs `write` with the base slug, then retries with a uniquified suffix on a
// Prisma P2002 slug collision. Shared by first-save (queue) and duplicate so the
// collision-retry lives in one side-effect-free module (queue.ts connects Redis
// at import, so it can't be the home for reusable helpers).
export async function withUniqueSlug<T>(
  baseSlug: string,
  write: (slug: string) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    try {
      return await write(slug)
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        (err.meta?.target as string[] | undefined)?.includes('slug') &&
        attempt < maxRetries
      ) {
        continue
      }
      throw err
    }
  }
  throw new Error(`Failed to create unique slug after ${maxRetries} attempts`)
}
