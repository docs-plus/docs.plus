import changeHeadingLevelBackward from './changeHeadingLevel-backward'
import changeHeadingLevelForward from './changeHeadingLevel-forward'
import changeHeadingLevelForwardH1 from './changeHeadingLevel-h1'

const changeHeadingLevel = (arrg, attributes) => {
  const { state } = arrg
  const { selection } = state
  const { $from, $to } = selection
  const { start } = $from.blockRange($to)

  const comingLevel = attributes.level
  const currentHLevel = $from.doc.nodeAt(start).attrs.level

  if (comingLevel === currentHLevel) {
    console.info('[heading]: comingLevel === nextSiblingLevel')
    return true
  }

  // H1
  if (currentHLevel === 1) {
    console.info('[Heading]: change heading level forward, currentHLevel === 1')
    return changeHeadingLevelForwardH1(arrg, attributes)
  }

  // H2 > H3 || H4 > H3
  if (comingLevel > currentHLevel) {
    console.info('[Heading]: change heading level forward, comingLevel > currentHLevel')
    return changeHeadingLevelForward(arrg, attributes)
  }

  // H2 < H3 || H4 < H3
  if (comingLevel < currentHLevel) {
    console.info('[Heading]: change heading level backward, comingLevel < currentHLevel')
    return changeHeadingLevelBackward(arrg, attributes)
  }

  return true
}

export default changeHeadingLevel
