import { createCopyPastePlugin, normalizePastedHtml } from '../plugins/copyPastePlugin'
import clipboardPaste from '../clipboardPaste'
import deleteSelectedRange from '../deleteSelectedRange'
import { getSelectionBlocks } from '../helper'
import {
  buildDoc,
  createTestSchema,
  getFirstTextPos,
  heading,
  paragraph
} from '../testUtils/testSchema'

jest.mock('../clipboardPaste', () => jest.fn(() => 'transformed-slice'))
jest.mock('../deleteSelectedRange', () => jest.fn(() => true))
jest.mock('../helper', () => ({
  getSelectionBlocks: jest.fn()
}))

const makeEditor = () => {
  const schema = createTestSchema()
  const doc = buildDoc(schema, [heading(schema, 1, 'Root', [paragraph(schema, 'seed content')])])
  const from = getFirstTextPos(doc)
  const to = from + 4

  return {
    state: {
      selection: { from, to },
      doc,
      schema
    }
  }
}

const getPluginProps = (plugin: any) => plugin.props || plugin.spec.props

describe('copyPastePlugin', () => {
  beforeEach(() => {
    jest.mocked(clipboardPaste).mockClear()
    jest.mocked(deleteSelectedRange).mockClear()
    jest.mocked(getSelectionBlocks).mockReset()
  })

  it('transformPastedHTML converts actual div tags and preserves text/attributes', () => {
    const editor = makeEditor()
    const plugin = createCopyPastePlugin(editor)
    const props = getPluginProps(plugin)

    const input =
      '<p class="content-divider">divided text</p><div data-test="x">Block</div><div>Second</div>'
    const output = props.transformPastedHTML(input)

    expect(output).toContain('content-divider')
    expect(output).toContain('divided text')
    expect(output).toContain('<span data-test="x">Block</span>')
    expect(output).toContain('<span>Second</span>')
    expect(output).not.toContain('<div data-test="x">Block</div>')
  })

  it('normalizePastedHtml preserves schema wrapper divs while converting generic divs', () => {
    const input = [
      '<div data-type="heading" class="heading" level="2">Heading Wrapper</div>',
      '<div data-type="contentWrapper"><p>Body</p></div>',
      '<div class="external-block">External</div>'
    ].join('')

    const output = normalizePastedHtml(input)

    expect(output).toContain(
      '<div data-type="heading" class="heading" level="2">Heading Wrapper</div>'
    )
    expect(output).toContain('<div data-type="contentWrapper"><p>Body</p></div>')
    expect(output).toContain('<span class="external-block">External</span>')
    expect(output).not.toContain('<div class="external-block">External</div>')
  })

  it('transformPasted delegates to clipboardPaste', () => {
    const editor = makeEditor()
    const plugin = createCopyPastePlugin(editor)
    const props = getPluginProps(plugin)
    const fakeSlice = { some: 'slice' }

    const result = props.transformPasted(fakeSlice)

    expect(clipboardPaste).toHaveBeenCalledTimes(1)
    expect(clipboardPaste).toHaveBeenCalledWith(fakeSlice, editor)
    expect(result).toBe('transformed-slice')
  })

  it('transformCopied after cut triggers deleteSelectedRange', () => {
    const editor = makeEditor()
    const plugin = createCopyPastePlugin(editor)
    const props = getPluginProps(plugin)

    const schema = editor.state.schema
    jest
      .mocked(getSelectionBlocks)
      .mockReturnValue([paragraph(schema, 'copied paragraph').toJSON()])

    props.handleDOMEvents.cut()
    const result = props.transformCopied()

    expect(getSelectionBlocks).toHaveBeenCalledTimes(1)
    expect(deleteSelectedRange).toHaveBeenCalledTimes(1)
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
  })

  it('transformCopied after copy does not trigger deleteSelectedRange', () => {
    const editor = makeEditor()
    const plugin = createCopyPastePlugin(editor)
    const props = getPluginProps(plugin)

    const schema = editor.state.schema
    jest
      .mocked(getSelectionBlocks)
      .mockReturnValue([paragraph(schema, 'copied paragraph').toJSON()])

    props.handleDOMEvents.copy()
    props.transformCopied()

    expect(getSelectionBlocks).toHaveBeenCalledTimes(1)
    expect(deleteSelectedRange).not.toHaveBeenCalled()
  })

  it('resets cut event state after transformCopied to avoid stale delete on next copy', () => {
    const editor = makeEditor()
    const plugin = createCopyPastePlugin(editor)
    const props = getPluginProps(plugin)

    const schema = editor.state.schema
    jest
      .mocked(getSelectionBlocks)
      .mockReturnValue([paragraph(schema, 'copied paragraph').toJSON()])

    props.handleDOMEvents.cut()
    props.transformCopied()
    props.transformCopied()

    expect(deleteSelectedRange).toHaveBeenCalledTimes(1)
  })
})
