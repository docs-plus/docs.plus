import { useStore } from '@stores'
import Head from 'next/head'

/**
 * Title/description/keywords for SPA navigations only. Social crawlers do not execute
 * JavaScript, so the SSR <Head> in pages/*.tsx owns every og: and twitter: tag they see.
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://docs.plus'

const DEFAULT_METADATA = {
  title: 'docs.plus',
  description:
    'docs.plus is an open-source, real-time collaborative tool that enables communities to share and organize knowledge in a hierarchical manner. Collaborate on documents and share knowledge in a structured, logical way.',
  keywords: 'docs, collaborative, real-time, knowledge, open-source'
}

const HeadSeo = () => {
  const metadata = useStore((state) => state.settings.metadata)

  const buildMetadata = ({ title, description, keywords, slug }: any) => ({
    title: title || DEFAULT_METADATA.title,
    description: description || DEFAULT_METADATA.description,
    url: slug ? `${SITE_URL}/${slug}` : SITE_URL,
    keywords: typeof keywords === 'string' ? keywords : DEFAULT_METADATA.keywords
  })

  const seoMetadata = buildMetadata(metadata || {})

  return (
    <Head>
      <title>{seoMetadata.title}</title>
      <meta name="description" content={seoMetadata.description} />
      <meta name="keywords" content={seoMetadata.keywords} />
    </Head>
  )
}

export default HeadSeo
