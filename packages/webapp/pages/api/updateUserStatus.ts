// pages/api/updateUserStatus.ts

import { type NextApiRequest, type NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

interface UpdateUserStatusRequestBody {
  userId: string
  status: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createPagesServerClient({ req, res })

  if (req.method === 'POST') {
    const { userId, status } = req.body as UpdateUserStatusRequestBody

    try {
      await updateSupabaseUserStatus(userId, status, supabase)
      res.status(200).json({ message: 'User status updated' })
    } catch (error) {
      res.status(500).json({ error: 'Error updating user status' })
    }
  } else {
    res.setHeader('Allow', ['POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}

async function updateSupabaseUserStatus(userId: string, status: string, supabase: any) {
  try {
    const { error } = await supabase.from('users').update({ status: status }).eq('id', userId)

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Supabase error:', error)
    throw error // Re-throw to be caught in the handler
  }
}
