import { GetServerSidePropsContext } from 'next'

export function getHostname(context: GetServerSidePropsContext): string {
  try {
    const hostname =
      context.req?.headers?.host || process.env.NEXT_PUBLIC_DEFAULT_HOSTNAME || 'localhost'

    if (!hostname || hostname.trim() === '') {
      return process.env.NEXT_PUBLIC_DEFAULT_HOSTNAME || 'localhost'
    }

    return hostname
  } catch {
    return process.env.NEXT_PUBLIC_DEFAULT_HOSTNAME || 'localhost'
  }
}
