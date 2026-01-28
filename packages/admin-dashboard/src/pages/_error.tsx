import { NextPage, NextPageContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { LuServerCrash, LuFileQuestion } from 'react-icons/lu'

interface ErrorProps {
  statusCode: number
}

const ErrorPage: NextPage<ErrorProps> = ({ statusCode }) => {
  const is404 = statusCode === 404
  const Icon = is404 ? LuFileQuestion : LuServerCrash
  const title = is404 ? 'Page Not Found' : 'Server Error'
  const message = is404
    ? "The page you're looking for doesn't exist or has been moved."
    : 'Something went wrong on our end. Please try again later.'

  return (
    <>
      <Head>
        <title>
          {statusCode} - {title} | Admin Dashboard
        </title>
      </Head>

      <div className="bg-base-200 flex min-h-screen items-center justify-center">
        <div className="max-w-md px-4 text-center">
          <Icon
            className={`mx-auto mb-6 h-20 w-20 ${is404 ? 'text-base-content/30' : 'text-error'}`}
          />
          <h1 className="mb-3 text-3xl font-bold">{title}</h1>
          <p className="text-base-content/60 mb-6">{message}</p>
          <Link href="/" className="btn btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </>
  )
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404
  return { statusCode }
}

export default ErrorPage
