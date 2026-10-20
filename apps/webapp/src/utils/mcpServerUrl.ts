import config from '@config'

/** The MCP connector address that every host row copies or links. It must equal the PRM `resource`. */
export const mcpServerUrl = (): string =>
  `${(process.env.NEXT_PUBLIC_RESTAPI_URL ?? '').replace(/\/+$/, '')}/mcp`

/** The server name every command, link and prompt registers, so each app lists one `docs-plus`. */
export const MCP_SERVER_NAME = 'docs-plus'

export const MCP_GUIDE_URL = `${config.links.githubRepoUrl}/blob/main/docs/mcp/README.md`
