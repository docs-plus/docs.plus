import { createClient } from '@supabase/supabase-js'
const { VITE_SUPABASE_PUBLIC_KEY, VITE_SUPABASE_URL } = import.meta.env

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLIC_KEY)

console.log(supabase)



export { supabase }


