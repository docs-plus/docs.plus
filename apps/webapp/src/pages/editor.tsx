import type { EditorPlaygroundProps } from '@components/pages/editor/EditorPlayground'
import { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'

// The playground pulls in the whole editor stack. Loading it on the server made
// requiring this module fail in the production bundle, so the route answered 500
// before getServerSideProps could run. Same guard `[...slugs]` uses for the pad.
const EditorPlayground = dynamic(() => import('@components/pages/editor/EditorPlayground'), {
  ssr: false
})

export const getServerSideProps: GetServerSideProps<EditorPlaygroundProps> = async ({ query }) => {
  // Dev/E2E-only playground — it exposes window._editor/_store escape hatches, so
  // it must never be routable in production.
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_E2E !== 'true') {
    return { notFound: true }
  }

  return {
    props: {
      localPersistence: query.localPersistence === 'true',
      docName: (query.docName as string) || 'example-document'
    }
  }
}

export default EditorPlayground
