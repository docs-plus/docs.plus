import { GetServerSidePropsContext } from 'next'

/**
 * Gets the hostname from the request with robust fallback options
 * @param context NextJS context from getServerSideProps
 * @returns The hostname or a suitable fallback
 */
export function getHostname(context: GetServerSidePropsContext): string {
  try {
    const hostname =
      context.req?.headers?.host || process.env.NEXT_PUBLIC_DEFAULT_HOSTNAME || 'localhost'

    // Ensure hostname is not empty or malformed
    if (!hostname || hostname.trim() === '') {
      return process.env.NEXT_PUBLIC_DEFAULT_HOSTNAME || 'localhost'
    }

    return hostname
  } catch (error) {
    // Silent fallback for production use
    return process.env.NEXT_PUBLIC_DEFAULT_HOSTNAME || 'localhost'
  }
}
