import { useStore } from '@stores'
import Head from 'next/head'

/**
 * HeadSeo — Client-side dynamic meta tag updates.
 *
 * IMPORTANT: This component runs CLIENT-SIDE only (inside ssr:false DocumentPage).
 * Social crawlers (Slack, Discord, Twitter, Facebook, iMessage) will NEVER see these tags.
 * Server-rendered OG tags for crawlers are in [...slugs].tsx (via getServerSideProps).
 *
 * This component handles:
 * - Dynamic <title> updates as user navigates (client-side SPA navigation)
 * - Dynamic meta description/keywords updates
 * - Client-side SEO hints (mostly for SPA navigation, not for crawlers)
 *
 * Tags NOT set here (owned by _document.tsx or page components):
 * - og:type, og:site_name → _document.tsx (global)
 * - og:title, og:description, og:url, og:image → [...slugs].tsx (SSR per-page)
 * - twitter:card → _document.tsx (global)
 * - twitter:title, twitter:description, twitter:image → [...slugs].tsx (SSR per-page)
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://docs.plus'

const DEFAULT_METADATA = {
  title: 'docs.plus',
  description:
    'docs.plus is an open-source, real-time collaborative tool that enables communities to share and organize knowledge in a hierarchical manner. Collaborate on documents and share knowledge in a structured, logical way.',
  keywords: 'docs, collaborative, real-time, knowledge, open-source'
}

const HeadSeo = () => {
  const { metadata } = useStore((state) => state.settings)

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
