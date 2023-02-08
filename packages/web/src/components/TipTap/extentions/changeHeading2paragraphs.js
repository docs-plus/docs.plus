import { getSelectionBlocks, getRangeBlocks, getPrevHeadingList } from './helper'
import onHeading from './normalText/onHeading'
import onSelection from './normalText/onSelection'
export default (arrg) => {
  const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
  const { schema, selection, doc } = state
  const { $from, $to, $anchor, $cursor, $head } = selection
  const { start, end, depth } = $from.blockRange($to)

  const selectedContents = getSelectionBlocks(doc, start, $head.pos)
  const contentWrapper = getRangeBlocks(doc, start - 1, $from.start(1) - 1 + $from.doc.nodeAt($from.start(1) - 1).content.size)

  console.log({
    selectedContents,
    contentWrapper,
    $from,
    $to,
    $anchor,
    $cursor,
    $head
  })

  if ($anchor.pos === $head.pos) {
    console.info('[Heading], normalText on Heading block')

    return onHeading(arrg)
  } else {
    console.info('[Heading], normalText on selection')

    return onSelection(arrg)
  }
}
