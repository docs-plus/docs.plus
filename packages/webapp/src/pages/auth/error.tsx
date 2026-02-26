import Button from '@components/ui/Button'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { LuCircleAlert, LuHouse, LuRotateCcw } from 'react-icons/lu'

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

  const handleGoHome = () => {
    router.push('/')
  }

  return (
    <div className="bg-base-200 flex min-h-[100dvh] items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Error card */}
        <div className="rounded-box bg-base-100 p-6 shadow-xl sm:p-8">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="bg-error/10 flex size-16 items-center justify-center rounded-full">
              <LuCircleAlert size={32} className="text-error" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-base-content mb-2 text-center text-2xl font-bold">
            Authentication Error
          </h1>
          <p className="text-base-content/60 mb-6 text-center text-sm">
            Something went wrong during authentication.
          </p>

          {/* Error details */}
          <div className="border-error/20 bg-error/5 mb-6 space-y-3 rounded-xl border p-4">
            <div>
              <p className="text-base-content/50 text-xs font-medium tracking-wide uppercase">
                Error
              </p>
              <p className="text-base-content font-medium">{errorDetails.error}</p>
            </div>

            {errorDetails.errorCode && (
              <div>
                <p className="text-base-content/50 text-xs font-medium tracking-wide uppercase">
                  Code
                </p>
                <p className="text-base-content/80 font-mono text-sm">{errorDetails.errorCode}</p>
              </div>
            )}

            {errorDetails.errorDescription && (
              <div>
                <p className="text-base-content/50 text-xs font-medium tracking-wide uppercase">
                  Details
                </p>
                <p className="text-base-content/70 text-sm">{errorDetails.errorDescription}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={handleRetry}
              variant="ghost"
              className="text-base-content/70 flex-1"
              startIcon={LuRotateCcw}>
              Try Again
            </Button>
            <Button onClick={handleGoHome} variant="primary" className="flex-1" startIcon={LuHouse}>
              Go Home
            </Button>
          </div>
        </div>

        {/* Help text */}
        <p className="text-base-content/60 mt-6 text-center text-sm">
          If this problem persists, please{' '}
          <a
            href="https://docs.plus/support"
            className="text-primary font-medium hover:underline"
            target="_blank"
            rel="noopener noreferrer">
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  )
}

export default AuthErrorPage

// Disable static generation - this page needs router query params at runtime
export const getServerSideProps = () => ({ props: {} })
