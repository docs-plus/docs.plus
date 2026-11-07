import SignInForm from '@components/auth/SignInForm'
import { HomepageLink, PageCard } from '@components/PageCard'
import { LEGAL_CONTACT_EMAIL } from '@components/pages/legal/legalMetadata'
import { Banner } from '@components/ui/Banner'
import Button, { quietActionClassName } from '@components/ui/Button'
import { supabaseClient } from '@utils/supabase'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const AuthErrorPage = () => {
  const router = useRouter()
  // A spent link usually opens after the reader already signed in with a newer one.
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)))
  }, [])

  // proxy.ts forwards only `error_code`; getServerSideProps fills the query on first render.
  // URL text is never shown, so a crafted link cannot put its own words on this page.
  const expired = router.query.error_code === 'otp_expired'
  const title = expired ? 'This sign-in link no longer works' : 'Sign-in did not finish'
  const reason = expired
    ? 'A sign-in link works once, for 1 hour.'
    : 'Something went wrong while signing you in.'

  const ways = (
    <>
      <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className={quietActionClassName}>
        Contact support
      </a>
      <HomepageLink />
    </>
  )

  return (
    <>
      <Head>
        <title>{`${title} — docs.plus`}</title>
      </Head>
      {signedIn ? (
        <PageCard title="You're already signed in" description={reason} actions={ways}>
          <Banner tone="info">You don&apos;t need this link. Your account is open here.</Banner>
          <Button variant="primary" shape="block" onClick={() => router.push('/')}>
            Continue to docs.plus
          </Button>
        </PageCard>
      ) : (
        // The original page is lost by here, so a sign-in from this card lands home.
        <SignInForm returnTo="/">
          {({ sent, title: sentTitle, description, body, back }) => (
            <PageCard
              title={sent ? sentTitle : title}
              description={sent ? description : `${reason} Send a new link below.`}
              actions={ways}>
              {body}
              {back ? <div className="self-start">{back}</div> : null}
            </PageCard>
          )}
        </SignInForm>
      )}
    </>
  )
}

export default AuthErrorPage

export const getServerSideProps = () => ({ props: {} })
