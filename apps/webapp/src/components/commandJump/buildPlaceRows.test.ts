import { Icons } from '@icons'

import { buildPlaceRows } from './buildPlaceRows'

describe('buildPlaceRows', () => {
  it('includes the Connect AI app (MCP) row with keywords and navigates to /mcp', () => {
    const navigate = jest.fn()
    const rows = buildPlaceRows({
      surface: 'home',
      signedIn: false,
      isHistory: false,
      isMobile: false,
      editor: null,
      navigate
    })

    const mcpRow = rows.find((row) => row.id === 'mcp')
    expect(mcpRow).toBeDefined()
    expect(mcpRow?.label).toBe('Connect AI app (MCP)')
    expect(mcpRow?.icon).toBe(Icons.plug)
    expect(mcpRow?.keywords).toEqual(['claude', 'chatgpt', 'cursor', 'codex', 'agent', 'llm'])

    mcpRow?.run()
    expect(navigate).toHaveBeenCalledWith('/mcp')
  })

  it('keeps the MCP row across pad and history surfaces', () => {
    for (const isHistory of [false, true]) {
      const rows = buildPlaceRows({
        surface: 'pad',
        signedIn: true,
        isHistory,
        isMobile: true,
        editor: null,
        navigate: jest.fn()
      })
      expect(rows.some((row) => row.id === 'mcp')).toBe(true)
    }
  })
})
