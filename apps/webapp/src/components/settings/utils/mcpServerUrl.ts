/** The MCP connector address that every host row copies or links. It must equal the PRM `resource`. */
export const mcpServerUrl = (): string =>
  `${(process.env.NEXT_PUBLIC_RESTAPI_URL ?? '').replace(/\/+$/, '')}/mcp`
