import { HomepageLink, PageCard } from '@components/PageCard'
import Button, { quietActionClassName } from '@components/ui/Button'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { LuCircleAlert } from 'react-icons/lu'

const AuthErrorPage = () => {
  const router = useRouter()
  const [errorDetails, setErrorDetails] = useState({
    error: '',
    errorCode: '',
    errorDescription: ''
  })

  useEffect(() => {
    if (router.isReady) {
      setErrorDetails({
        error: String(router.query.error || 'Unknown error'),
        errorCode: String(router.query.error_code || ''),
        errorDescription: String(router.query.error_description || '')
      })
    }
  }, [router.isReady, router.query])

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
        meta={
          errorDetails.errorCode && (
            <>
              Code <code className="text-base-content font-sans">{errorDetails.errorCode}</code>
            </>
          )
        }
        actions={
          <>
            <a
              href="https://docs.plus/support"
              className={quietActionClassName}
              target="_blank"
              rel="noopener noreferrer">
              Contact support
            </a>
            <HomepageLink />
          </>
        }>
        {errorDetails.error && (
          <div className="alert alert-soft alert-error items-start px-3 py-2 text-sm">
            <LuCircleAlert size={16} className="text-error mt-0.5 shrink-0" aria-hidden />
            <div className="text-base-content flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
              <p className="font-semibold">{errorDetails.error}</p>
              {errorDetails.errorDescription && <p>{errorDetails.errorDescription}</p>}
            </div>
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
