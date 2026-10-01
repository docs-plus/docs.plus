import { HomepageLink, PageCard } from '@components/PageCard'
import * as Sentry from '@sentry/nextjs'
import type { NextPageContext } from 'next'
import Head from 'next/head'

function Error({ statusCode }: { statusCode?: number }) {
  const isServer = !!statusCode
  const title = isServer ? 'Server error' : 'Something went wrong'

  return (
    <>
      <Head>
        <title>{`${title} — docs.plus`}</title>
      </Head>
      <PageCard
        title={title}
        description={
          isServer
            ? `An error ${statusCode} occurred on the server.`
            : 'An error occurred on the client.'
        }
        actions={<HomepageLink />}
      />
    </>
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
