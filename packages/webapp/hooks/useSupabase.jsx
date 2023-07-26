'use client'

import { useState } from 'react'
import { useSupabase } from '../context/supabase-provider'

export default function NewPost() {
  const [content, setContent] = useState('')
  const { supabase } = useSupabase()

  const handleSave = async () => {
    const { data } = await supabase.from('posts').insert({ content }).select()
  }

  return (
    <>
      <input onChange={(e) => setContent(e.target.value)} value={content} />
      <button onClick={handleSave}>Save</button>
    </>
  )
}
