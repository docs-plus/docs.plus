import Head from 'next/head'
import { useStore } from '@stores'

const DEFAULT_METADATA = {
  title: 'docs.plus',
  description:
    'docs.plus is an open-source, real-time collaborative tool that enables communities to share and organize knowledge in a hierarchical manner. Collaborate on documents and share knowledge in a structured, logical way.',
  url: 'http://docs.plus',
  keywords: 'docs, collaborative, real-time, knowledge, open-source',
  image: '/icons/android-chrome-512x512.png'
}

const HeadSeo = () => {
  const { metadata } = useStore((state) => state.settings)

  const buildMetadata = ({ title, description, keywords, slug }: any) => ({
    title: title || DEFAULT_METADATA.title,
    description: description || DEFAULT_METADATA.description,
    url: slug ? `${DEFAULT_METADATA.url}/${slug}` : DEFAULT_METADATA.url,
    keywords: typeof keywords === 'string' ? keywords : DEFAULT_METADATA.keywords
  })

  const seoMetadata = buildMetadata(metadata || {})

  return (
    <Head>
      <title>{seoMetadata.title}</title>
      <meta name="description" content={seoMetadata.description} />
      <meta name="keywords" content={seoMetadata.keywords} />
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, notranslate" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={seoMetadata.url} />
      <meta name="twitter:title" content={seoMetadata.title} />
      <meta name="twitter:description" content={seoMetadata.description} />
      <meta name="twitter:image" content={DEFAULT_METADATA.image} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={seoMetadata.title} />
      <meta property="og:description" content={seoMetadata.description} />
      <meta property="og:site_name" content={DEFAULT_METADATA.title} />
      <meta property="og:url" content={seoMetadata.url} />
      <meta property="og:image" content={DEFAULT_METADATA.image} />
    </Head>
  )
}

export default HeadSeo
