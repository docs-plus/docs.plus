import { logger } from '@utils/logger'

import changeHeadingLevelBackward from './changeHeadingLevel-backward'
import changeHeadingLevelForward from './changeHeadingLevel-forward'
import changeHeadingLevelForwardH1 from './changeHeadingLevel-h1'
import { CommandArgs, HeadingAttributes } from './types'

const changeHeadingLevel = (arrg: CommandArgs, attributes: HeadingAttributes): boolean => {
  // HN-10 §1: clamp level to valid range L = {1..10}
  const clampedLevel = Math.min(10, Math.max(1, attributes.level))
  if (clampedLevel !== attributes.level) {
    attributes = { ...attributes, level: clampedLevel }
  }

  const { state } = arrg
  const { selection } = state
  const { $from, $to } = selection
  const { start } = $from.blockRange($to)!

  const comingLevel = attributes.level
  const currentHLevel = $from.doc.nodeAt(start)!.attrs.level

  if (comingLevel === currentHLevel) {
    logger.info('[heading]: comingLevel === nextSiblingLevel')
    return true
  }

  // H1
  if (currentHLevel === 1) {
    logger.info('[Heading]: change heading level forward, currentHLevel === 1')
    return changeHeadingLevelForwardH1(arrg, attributes)
  }

  // H2 > H3 || H4 > H3
  if (comingLevel > currentHLevel) {
    logger.info('[Heading]: change heading level forward, comingLevel > currentHLevel')
    return changeHeadingLevelForward(arrg, attributes)
  }

  // H2 < H3 || H4 < H3
  if (comingLevel < currentHLevel) {
    logger.info('[Heading]: change heading level backward, comingLevel < currentHLevel')
    return changeHeadingLevelBackward(arrg, attributes)
  }

  return true
}

export default changeHeadingLevel
