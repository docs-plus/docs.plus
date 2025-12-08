import { useRouter } from 'next/router'

function Error({ statusCode }: { statusCode?: number }) {
  const router = useRouter()
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
          <button onClick={() => router.back()} className="btn btn-outline btn-sm">
            Go Back
          </button>
          <button onClick={() => router.push('/')} className="btn btn-primary btn-sm">
            Home
          </button>
        </div>
      </div>
    </div>
  )
}

Error.getInitialProps = ({
  res,
  err
}: {
  res?: { statusCode: number }
  err?: { statusCode: number }
}) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
