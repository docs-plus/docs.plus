import type { GetServerSidePropsContext } from 'next'

import { buildLlmsTxt, getServerSideProps } from '../../pages/llms.txt'

describe('llms.txt', () => {
  const prevRestApiUrl = process.env.NEXT_PUBLIC_RESTAPI_URL

  afterEach(() => {
    if (prevRestApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_RESTAPI_URL
    } else {
      process.env.NEXT_PUBLIC_RESTAPI_URL = prevRestApiUrl
    }
  })

  it('builds concise plain text with MCP links, /new, and markdown negotiation', () => {
    const body = buildLlmsTxt('https://docs.plus', 'https://prodback.docs.plus/api/mcp')

    expect(body).toContain('https://docs.plus/mcp')
    expect(body).toContain('MCP server URL: https://prodback.docs.plus/api/mcp')
    expect(body).toContain('https://docs.plus/new')
    expect(body).toContain('Accept: text/markdown')
    expect(body.toLowerCase()).not.toContain('outline')
  })

  it('omits the MCP server URL line when the REST URL is relative or unset', () => {
    const body = buildLlmsTxt('https://docs.plus', '/mcp')

    expect(body).toContain('https://docs.plus/mcp')
    expect(body).not.toContain('MCP server URL:')
  })

  it('serves 200 text/plain; charset=utf-8 via getServerSideProps', async () => {
    process.env.NEXT_PUBLIC_RESTAPI_URL = 'https://api.docs.plus/api'

    const setHeader = jest.fn()
    const write = jest.fn()
    const end = jest.fn()
    const context = {
      res: { setHeader, write, end }
    } as unknown as GetServerSidePropsContext

    const result = await getServerSideProps(context)

    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8')
    expect(write).toHaveBeenCalledTimes(1)
    const written = write.mock.calls[0][0] as string
    expect(written).toContain('MCP server URL: https://api.docs.plus/api/mcp')
    expect(written).toContain('/new')
    expect(written).toContain('Accept: text/markdown')
    expect(end).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ props: {} })
  })
})
