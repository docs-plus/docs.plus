import { composerModeEdgeAction } from './useComposerModeEdge'

describe('composerModeEdgeAction', () => {
  it.each([
    ['mount', 'comment', 'fill', false],
    ['mount', 'none', 'fill', true],
    ['comment', 'reply', 'replace', true],
    ['none', 'comment', 'keep', false],
    ['edit', 'comment', 'replace', false]
  ] as const)('%s -> %s loads %s, discards %s', (from, to, draftLoad, discardModeAdded) => {
    expect(composerModeEdgeAction(from, to)).toEqual({ to, draftLoad, discardModeAdded })
  })
})
