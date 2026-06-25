import { HOME_CANONICAL_URL } from '@components/pages/home/homeMetadata'
import { GetServerSideProps } from 'next'

/** Serves `/robots.txt` with env-aware sitemap URL. */
export default function Robots() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const origin = HOME_CANONICAL_URL.replace(/\/$/, '')
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.write(body)
  res.end()
  return { props: {} }
}
