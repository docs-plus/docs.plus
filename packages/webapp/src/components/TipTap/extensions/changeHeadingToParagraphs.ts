import { logger } from '@utils/logger'

import onHeading from './normalText/onHeading'
import onSelection from './normalText/onSelection'
import { CommandArgs } from './types'

const changeHeadingToParagraphs = (args: CommandArgs): boolean | void => {
  const { state, editor } = args
  const { selection } = state
  const { $anchor, $head } = selection

  if ($anchor.pos === $head.pos) {
    logger.info('[Heading], normalText on Heading block')
    return onHeading({ ...args, view: editor.view })
  } else {
    logger.info('[Heading], normalText on selection')
    return onSelection({ ...args, view: editor.view })
  }
}

export default changeHeadingToParagraphs
