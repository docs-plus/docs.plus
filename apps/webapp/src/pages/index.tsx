import {
  buildHomeWebSiteJsonLd,
  HOME_CANONICAL_URL,
  HOME_DESCRIPTION,
  HOME_OG_IMAGE,
  HOME_OG_IMAGE_ALT,
  HOME_TITLE
} from '@components/pages/home/homeMetadata'
import HomePage from '@components/pages/home/HomePage'
import { GetStaticProps } from 'next'
import Head from 'next/head'

interface HomeProps {
  hostname: string
  isMobile: boolean
  isAuthServiceAvailable: boolean
}

function Home({ hostname, isAuthServiceAvailable }: HomeProps) {
  const webSiteJsonLd = buildHomeWebSiteJsonLd()

  return (
    <>
      <Head>
        <title>{HOME_TITLE}</title>
        <meta name="description" content={HOME_DESCRIPTION} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={HOME_CANONICAL_URL} />

        <meta property="og:title" content={HOME_TITLE} />
        <meta property="og:description" content={HOME_DESCRIPTION} />
        <meta property="og:url" content={HOME_CANONICAL_URL} />
        <meta property="og:image" content={HOME_OG_IMAGE} />
        <meta property="og:image:alt" content={HOME_OG_IMAGE_ALT} />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />

        <meta name="twitter:title" content={HOME_TITLE} />
        <meta name="twitter:description" content={HOME_DESCRIPTION} />
        <meta name="twitter:url" content={HOME_CANONICAL_URL} />
        <meta name="twitter:image" content={HOME_OG_IMAGE} />
        <meta name="twitter:image:alt" content={HOME_OG_IMAGE_ALT} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
      </Head>

      <HomePage hostname={hostname} isAuthServiceAvailable={isAuthServiceAvailable} />
    </>
  )
}

export default Home

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  let hostname = process.env.NEXT_PUBLIC_DEFAULT_HOSTNAME || 'docs.plus'
  if (!process.env.NEXT_PUBLIC_DEFAULT_HOSTNAME && process.env.NEXT_PUBLIC_APP_URL) {
    try {
      hostname = new URL(process.env.NEXT_PUBLIC_APP_URL).host
    } catch {
      // malformed env — keep default
    }
  }

  return {
    props: {
      hostname,
      isMobile: false,
      isAuthServiceAvailable: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    }
  }
}
