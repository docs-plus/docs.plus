import HomePage from '@components/pages/home/HomePage'
import { GetServerSidePropsContext } from 'next'

import { getDeviceInfo } from '../lib/helpers'
import { getHostname } from '../utils'

function Home({ hostname }: { hostname: string }) {
  return <HomePage hostname={hostname} />
}

export default Home

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { isMobile } = getDeviceInfo(context)

  return {
    props: {
      hostname: getHostname(context),
      isMobile
    }
  }
}
