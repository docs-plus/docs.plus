import Link from 'next/link'

export default function Custom500() {
  return (
    <div className="bg-base-200 grid min-h-screen place-items-center p-4">
      <div className="text-center">
        <p className="text-error text-8xl font-bold">500</p>
        <h1 className="text-base-content mt-4 text-2xl font-semibold">Something went wrong</h1>
        <p className="text-base-content/60 mt-2 max-w-md">
          An unexpected error occurred. Please try again later.
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
