import * as Sentry from '@sentry/nextjs'
import type { NextPageContext } from 'next'
import Link from 'next/link'

function Error({ statusCode }: { statusCode?: number }) {
  const isServer = !!statusCode

  return (
    <div className="bg-base-200 grid min-h-screen place-items-center p-4">
      <div className="text-center">
        <p className="text-base-content/20 text-8xl font-bold">{statusCode || '!'}</p>
        <h1 className="text-base-content mt-4 text-2xl font-semibold">
          {isServer ? 'Server error' : 'Something went wrong'}
        </h1>
        <p className="text-base-content/60 mt-2">
          {isServer
            ? `An error ${statusCode} occurred on the server.`
            : 'An error occurred on the client.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="btn btn-primary btn-sm">
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}

Error.getInitialProps = async (contextData: NextPageContext) => {
  // Forward render/SSR errors to GlitchTip (no-ops when no DSN is configured).
  await Sentry.captureUnderscoreErrorException(contextData)
  const { res, err } = contextData
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404
  return { statusCode }
}

export default Error
