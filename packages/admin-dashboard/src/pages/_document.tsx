import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" data-theme="docsplus">
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body className="bg-base-100 text-base-content">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
