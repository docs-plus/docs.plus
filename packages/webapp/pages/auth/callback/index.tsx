import { type CookieOptions, createServerClient, serialize } from '@supabase/ssr'
import { type GetServerSidePropsContext } from 'next'
import Link from 'next/link'

export default function page({}) {
  return (
    <div>
      <Link href="/">Home</Link>
    </div>
  )
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  // get qeury params
  const { code, next } = context.query as { code: string; next: string }

  // if code is present
  if (code) {
    // create supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return context.req.cookies[name]
          },
          set(name, value, options) {
            context.res.appendHeader('Set-Cookie', serialize(name, value, options))
          },
          remove(name, options) {
            context.res.appendHeader('Set-Cookie', serialize(name, '', options))
          }
        }
      }
    )

    // exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // redirect to home
      console.log('redirect')
      return {
        redirect: {
          destination: next || '/',
          permanent: false
        }
      }
    }

    // if no error
    // if (!error) {
    //   // redirect to home
    //   return {
    //     redirect: {
    //       destination: '/',
    //       permanent: false
    //     }
    //   }
    // }
  }

  return {
    props: {}
  }
}
