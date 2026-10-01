import { HomepageLink, PageCard } from '@components/PageCard'
import Head from 'next/head'

export default function Custom404() {
  return (
    <>
      <Head>
        <title>Page not found — docs.plus</title>
      </Head>
      <PageCard
        title="Page not found"
        description="The page you're looking for doesn't exist."
        actions={<HomepageLink />}
      />
    </>
  )
}
