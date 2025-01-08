import expressRouter from '../../utils/router.mjs'
import { createClient } from '@supabase/supabase-js'
const router = expressRouter()

export const checkSupabaseHealth = async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return { status: 'disabled' }
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    const { error } = await supabase.from('users').select('id').limit(1)

    if (error) {
      return {
        status: 'unhealthy',
        error: error.message
      }
    }
    return { status: 'healthy' }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    }
  }
}

router.get('/', async (req, res) => {
  const health = await checkSupabaseHealth()
  const statusCode = health.status === 'healthy' ? 200 : 503
  res.status(statusCode)
  return health
})

export default router.expressRouter
