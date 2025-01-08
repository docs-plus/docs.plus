import expressRouter from '../../utils/router.mjs'
const router = expressRouter()

export const checkDatabaseHealth = async (prisma) => {
  if (!prisma) {
    return {
      status: 'unhealthy',
      error: 'Prisma client not initialized'
    }
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'healthy' }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    }
  }
}

router.get('/', async (req, res) => {
  const prisma = req.app.locals.prisma
  const health = await checkDatabaseHealth(prisma)
  res.status(health.status === 'healthy' ? 200 : 503)
  return health
})

export default router.expressRouter
