import { GetServerSidePropsContext } from 'next'
import { useAuthStore } from '@stores'
import Loading from '@components/ui/Loading'
import HomePage from '@components/pages/home/HomePage'
import { getHostname } from '../utils'

function Home({ hostname }: { hostname: string }) {
  const authLoading = useAuthStore((state) => state.loading)

  if (authLoading) return <Loading size="lg" />

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
