import { HomepageLink, PageCard } from '@components/PageCard'
import Button from '@components/ui/Button'
import Head from 'next/head'

export default function Custom500() {
  return (
    <>
      <Head>
        <title>Something went wrong — docs.plus</title>
      </Head>
      <PageCard
        title="Something went wrong"
        description="We could not load this page. Reload to try again."
        actions={<HomepageLink />}>
        <Button variant="primary" shape="block" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </PageCard>
    </>
  )
}
