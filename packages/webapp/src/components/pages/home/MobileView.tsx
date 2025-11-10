import HeadSeo from '@components/HeadSeo'
import DeckPanel from '../panels/DeckPanel'
import dynamic from 'next/dynamic'

const DashboardLayout = dynamic(() => import('@pages/document/layouts/DashboardLayout'))

const MobileView = ({ hostname }: { hostname: string }) => {
  return (
    <>
      <HeadSeo />

      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="flex flex-wrap rounded-md bg-white p-2 pb-2 shadow-md sm:m-auto sm:justify-center sm:p-6 sm:py-6 sm:pb-2">
          <DashboardLayout>
            <DeckPanel hostname={hostname} />
          </DashboardLayout>
        </div>
      </div>
    </>
  )
}

export default MobileView
