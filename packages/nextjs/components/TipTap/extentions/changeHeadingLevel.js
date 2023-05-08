import changeHeadingLevelBackward from './changeHeadingLevel-backward'
import changeHeadingLevelForward from './changeHeadingLevel-forward'
import changeHeadingLevelForwardH1 from './changeHeadingLevel-h1'

const changeHeadingLevel = (arrg, attributes) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state
  const { $from, $to, $anchor, $cursor } = selection
  const { start, end, depth } = $from.blockRange($to)

  const commingLevel = attributes.level
  const currentHLevel = $from.doc.nodeAt(start).attrs.level

  if (commingLevel === currentHLevel) {
    console.info('[heading]: commingLevel === nextSiblingLevel')

    return true
  }

  // H1
  if (currentHLevel === 1) {
    return changeHeadingLevelForwardH1(arrg, attributes)
  }

  // H2 > H3 || H4 > H3
  if (commingLevel > currentHLevel) {
    return changeHeadingLevelForward(arrg, attributes)
  }

  // H2 < H3 || H4 < H3
  if (commingLevel < currentHLevel) {
    return changeHeadingLevelBackward(arrg, attributes)
  }

  return true
}

export default changeHeadingLevel
