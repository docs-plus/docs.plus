import Head from 'next/head'

const TITLE = 'docs.plus'
const DESCRIPTION =
  'docs.plus is an open-source, real-time collaborative tool that enables communities to share and organize knowledge in a hierarchical manner. Collaborate on documents and share knowledge in a structured, logical way.'
const URL = 'http://docs.plus'
const KEYWORDS = 'docs, collaborative, real-time, knowledge, open-source'
const IMAGE = '/icons/android-chrome-512x512.png'

const HeadSeo = (
  { title, description, url, keywords } = {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    keywords: KEYWORDS
  }
) => {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, notranslate" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={IMAGE} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={TITLE} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={IMAGE} />
    </Head>
  )
}

export default HeadSeo
