import { TextSelection } from '@tiptap/pm/state'
import { getPrevHeadingList, getHeadingsBlocksMap, findPrevBlock } from '../helper'
import onHeading from './onHeading'

const CONTENT_HEADING_TYPE = 'contentHeading'
const HEADING_TYPE = 'heading'
const CONTENT_WRAPPER_TYPE = 'contentWrapper'

const getSelectionBlocks = (doc, start, end, includeContentHeading = false) => {
  const firstHEading = true
  const selectedContents = []

  doc.nodesBetween(start, end, function (node, pos, parent) {
    if (firstHEading && node.type.name !== 'heading' && parent.type.name === 'contentWrapper') {
      const depth = doc.resolve(pos).depth

      selectedContents.push({
        depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        ...node.toJSON()
      })
    }

    if (node.type.name === 'contentHeading') {
      const depth = doc.resolve(pos).depth

      selectedContents.push({
        depth,
        level: node.attrs?.level,
        attrs: includeContentHeading ? node.attrs : {},
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        type: includeContentHeading ? node.type.name : 'paragraph',
        content: node.toJSON().content
      })
    }
  })

  return selectedContents
}

const extractParagraphsAndHeadings = (clipboardContents) => {
  const paragraphs = []
  const headings = []
  let heading = null

  for (const node of clipboardContents) {
    if (!heading && !node.level) {
      paragraphs.push(node)
    }

    if (node.level) {
      // if new heading is found, push the previous heading into the heading list
      // and reset the heading
      if (heading) {
        headings.push(heading)
        heading = null
      }
      heading = {
        endBlockPos: node.endBlockPos,
        startBlockPos: node.startBlockPos,
        level: node.level,
        type: HEADING_TYPE,
        attrs: { level: node.level },
        content: [
          {
            type: CONTENT_HEADING_TYPE,
            attrs: { level: node.level },
            content: node.content
          },
          {
            type: CONTENT_WRAPPER_TYPE,
            content: []
          }
        ]
      }
    } else {
      heading?.content.at(1).content.push(node)
    }
  }

  if (heading) {
    headings.push(heading)
  }

  return [paragraphs, headings]
}

const onSelection = ({ state, tr, editor }) => {
  const { selection, doc } = state
  const { $from, $to, from, to } = selection

  let { start } = $from.blockRange($to)
  start = start === 0 ? from : start
  const prevHStartPos = 0

  const titleNodeTo = $from.doc.nodeAt($to.start(1) - 1)
  const titleStartPos = $from.start(1) - 1
  const titleEndPos = titleStartPos + titleNodeTo.content.size

  const selectedContents = getSelectionBlocks(doc, from, to)

  if (selectedContents[0]?.level) {
    onHeading({ state, tr, editor })
    return true
  }

  const restSelectionContents = getSelectionBlocks(doc, to, titleEndPos)
  restSelectionContents.shift()

  const [paragraphs, headings] = extractParagraphsAndHeadings(restSelectionContents)

  const newConent = [
    ...selectedContents.map((node) => state.schema.nodeFromJSON(node)),
    ...paragraphs.map((node) => state.schema.nodeFromJSON(node))
  ]

  const titleHMap = getHeadingsBlocksMap(doc, titleStartPos, titleEndPos)
  let mapHPost = titleHMap.filter((x) => x.startBlockPos < start - 1 && x.startBlockPos >= prevHStartPos)

  tr.deleteRange(selectedContents.at(0).startBlockPos, titleEndPos)
  tr.insert(selectedContents.at(0).startBlockPos, newConent)

  // update selection position
  const focusSelection = new TextSelection(tr.doc.resolve(to))
  tr.setSelection(focusSelection)

  // after all that, we need to loop through the rest of remaing heading to append
  for (const heading of headings) {
    const commingLevel = heading.level || heading.content.at(0).level

    mapHPost = getPrevHeadingList(tr, mapHPost[0].startBlockPos, tr.mapping.map(mapHPost[0].endBlockPos))
    mapHPost = mapHPost.filter(
      (x) => x.startBlockPos < heading.startBlockPos && x.startBlockPos >= prevHStartPos
    )

    const { prevBlock, shouldNested } = findPrevBlock(mapHPost, commingLevel)

    const node = state.schema.nodeFromJSON(heading)

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
  }

  return true
}

export default onSelection
