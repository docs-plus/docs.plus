import onHeading from './normalText/onHeading'
import onSelection from './normalText/onSelection'

export default (arrg) => {
  const { state } = arrg
  const { selection } = state
  const { $anchor, $head } = selection

  if ($anchor.pos === $head.pos) {
    console.info('[Heading], normalText on Heading block')

    return onHeading(arrg)
  } else {
    console.info('[Heading], normalText on selection')

    return onSelection(arrg)
  }
}
