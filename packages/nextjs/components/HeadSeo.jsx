import Head from 'next/head'

const TITLE = "Docs Plus"
const DESCRIPTION = "docs.plus is an open-source, real-time collaborative tool that enables communities to share and organize knowledge in a hierarchical manner. Collaborate on documents and share knowledge in a structured, logical way."
const URL = 'http://docs.plus'

const HeadSeo = ({title, description, url} = {title: TITLE, description: DESCRIPTION, url: URL}) => {
  return (
    <Head>
      <title>{title}</title>
      <meta content={description} name="description" />

      <meta name="twitter:card" content="Docs Plus" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content="/icons/maskable_icon_x512.png" />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="Docs Plus" />
      <meta property="og:url" content={url} />
      <meta property="og:image" content="/icons/maskable_icon_x512.png" />

    </Head>
   );
}

export default HeadSeo;