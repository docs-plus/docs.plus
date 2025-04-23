import { GetServerSidePropsContext } from 'next'
import MobileDetect from 'mobile-detect'
import dynamic from 'next/dynamic'
import { useAuthStore } from '@stores'
import Loading from '@components/ui/Loading'
import DesktopView from '@components/pages/home/DesktopView'
import { getHostname } from '../utils'

const MobileView = dynamic(() => import('@components/pages/home/MobileView'), {
  loading: () => <Loading size="lg" />
})

function Home({ hostname, isMobile }: { hostname: string; isMobile: boolean }) {
  const authLoading = useAuthStore((state) => state.loading)

  if (authLoading) return <Loading size="lg" />
  if (isMobile) return <MobileView hostname={hostname} />

  return <DesktopView hostname={hostname} />
}

export default Home

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const userAgent = context.req.headers['user-agent']
  const device = new MobileDetect(userAgent || '')

  return {
    props: {
      hostname: getHostname(context),
      isMobile: device.mobile() ? true : false
    }
  }
}
