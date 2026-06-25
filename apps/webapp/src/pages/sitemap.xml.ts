import { buildSitemapXml } from '@components/pages/home/homeMetadata'
import { GetServerSideProps } from 'next'

/** Serves `/sitemap.xml` — indexable routes only (see `INDEXABLE_PATHS`). */
export default function Sitemap() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.write(buildSitemapXml())
  res.end()
  return { props: {} }
}
