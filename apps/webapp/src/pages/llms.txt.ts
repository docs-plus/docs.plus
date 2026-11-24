import { buildLlmsTxt } from '@components/pages/home/homeMetadata'
import type { GetServerSideProps } from 'next'

export default function LlmsTxt() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const body = buildLlmsTxt()

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  if (req?.method !== 'HEAD') res.write(body)
  res.end()
  return { props: {} }
}
