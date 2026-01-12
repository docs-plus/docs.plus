import { GetServerSidePropsContext } from 'next'
import HomePage from '@components/pages/home/HomePage'
import { getHostname } from '../utils'

function Home({ hostname }: { hostname: string }) {
  return <HomePage hostname={hostname} />
}

export default Home

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: {
      hostname: getHostname(context)
    }
  }
}
