import { HomepageLink, PageCard } from '@components/PageCard'
import { LEGAL_CONTACT_EMAIL } from '@components/pages/legal/legalMetadata'
import Button, { quietActionClassName } from '@components/ui/Button'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { LuCircleAlert } from 'react-icons/lu'

const AuthErrorPage = () => {
  const router = useRouter()
  // proxy.ts forwards only `error_code`; getServerSideProps fills the query on first render.
  // URL text is never shown, so a crafted link cannot put its own words on this page.
  const message =
    router.query.error_code === 'otp_expired'
      ? 'This sign-in link has expired or was already used. Request a new link and try again.'
      : 'Sign-in did not finish. Try again, or contact support if it keeps failing.'

  const handleRetry = () => {
    router.back()
  }

  return (
    <>
      <Head>
        <title>Authentication error — docs.plus</title>
      </Head>
      <PageCard
        title="Authentication error"
        description="Something went wrong during authentication."
        actions={
          <>
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className={quietActionClassName}>
              Contact support
            </a>
            <HomepageLink />
          </>
        }>
        <div className="alert alert-soft alert-error items-start px-3 py-2 text-sm">
          <LuCircleAlert size={16} className="text-error mt-0.5 shrink-0" aria-hidden />
          <p className="text-base-content">{message}</p>
        </div>
        <Button variant="primary" shape="block" onClick={handleRetry}>
          Try again
        </Button>
      </PageCard>
    </>
  )
}

export default AuthErrorPage

export const getServerSideProps = () => ({ props: {} })
