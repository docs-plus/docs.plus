import type { PrismaConfig } from 'prisma/config'

// Type-only import: `--production` drops `prisma`, and the image's bunx CLI still
// loads this file. `generate` needs no URL, so an unset DATABASE_URL is not an error.
export default {
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL }
} satisfies PrismaConfig
