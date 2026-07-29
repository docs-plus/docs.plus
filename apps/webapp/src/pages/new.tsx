import { randomDocumentSlug } from '@utils/sanitizeDocumentSlug'
import { GetServerSidePropsContext } from 'next'

/**
 * Same-origin twin of the `new.{domain}` proxy rule in proxy.ts, reachable from
 * the PWA "New Document" shortcut and from direct navigation to /new.
 */
export async function getServerSideProps(_context: GetServerSidePropsContext) {
  const randomSlug = randomDocumentSlug()

  return {
    redirect: {
      destination: `/${randomSlug}`,
      permanent: false // 307 — each click should create a new doc
    }
  }
}

// Next.js requires a default export even for redirect-only pages
export default function NewDocument() {
  return null
}
