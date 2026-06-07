import { GetServerSidePropsContext } from 'next'

/**
 * /new → Generate a random document slug and redirect
 *
 * This mirrors the `new.{domain}` proxy logic in proxy.ts,
 * but works as a same-origin route for:
 *  - PWA shortcut ("New Document" in manifest.json)
 *  - Direct navigation (docs.plus/new)
 *  - Share target future use
 *
 * Uses 307 (Temporary Redirect) so each visit creates a NEW document.
 */
export async function getServerSideProps(_context: GetServerSidePropsContext) {
  const randomSlug = (Math.random() + 1).toString(36).substring(2)

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
