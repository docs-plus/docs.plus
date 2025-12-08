import { useRouter } from 'next/router'

export default function Custom404() {
  const router = useRouter()

  return (
    <div className="bg-base-200 grid min-h-screen place-items-center p-4">
      <div className="text-center">
        <p className="text-base-content/20 text-8xl font-bold">404</p>
        <h1 className="text-base-content mt-4 text-2xl font-semibold">Page not found</h1>
        <p className="text-base-content/60 mt-2">The page you're looking for doesn't exist.</p>
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
