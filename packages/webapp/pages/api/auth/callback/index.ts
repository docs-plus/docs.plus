import { NextApiHandler } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

const handler: NextApiHandler = async (req, res) => {
  const { code, next } = req.query as { code: string | null; next: string }

  if (code) {
    const supabase = createPagesServerClient({ req, res })
    await supabase.auth.exchangeCodeForSession(String(code))
  }

  if (next) res.redirect(next)
  else res.redirect('/')
}

export default handler
