import onHeading from './normalText/onHeading'
import onSelection from './normalText/onSelection'
import { CommandArgs } from './types'

const changeHeading2Paragrapht = (arrg: CommandArgs): boolean | void => {
  const { state, editor, tr } = arrg
  const { selection } = state
  const { $anchor, $head } = selection

  if ($anchor.pos === $head.pos) {
    console.info('[Heading], normalText on Heading block')
    return onHeading({ ...arrg, view: editor.view })
  } else {
    console.info('[Heading], normalText on selection')
    return onSelection({ ...arrg, view: editor.view })
  }
}

export default changeHeading2Paragrapht
