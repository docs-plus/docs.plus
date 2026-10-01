import { HomepageLink, PageCard } from '@components/PageCard'
import { LEGAL_CONTACT_EMAIL } from '@components/pages/legal/legalMetadata'
import Button, { quietActionClassName } from '@components/ui/Button'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { LuCircleAlert } from 'react-icons/lu'

const AuthErrorPage = () => {
  const router = useRouter()
  // proxy.ts forwards only `error_description`; getServerSideProps fills the query on first render.
  const description = String(router.query.error_description ?? '')

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
        {description && (
          <div className="alert alert-soft alert-error items-start px-3 py-2 text-sm">
            <LuCircleAlert size={16} className="text-error mt-0.5 shrink-0" aria-hidden />
            <p className="text-base-content min-w-0 [overflow-wrap:anywhere]">{description}</p>
          </div>
        )}
        <Button variant="primary" shape="block" onClick={handleRetry}>
          Try again
        </Button>
      </PageCard>
    </>
  )
}

export default AuthErrorPage

export const getServerSideProps = () => ({ props: {} })
