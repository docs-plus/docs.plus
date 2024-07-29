import { Slice } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import ENUMS from '../enums'
import { getRangeBlocks, getHeadingsBlocksMap, findPrevBlock, getPrevHeadingPos } from './helper'

const createNodeFromJSON = (node, schema) => schema.nodeFromJSON(node)

const extractParagraphsAndHeadings = (clipboardContents, { schema }) => {
  const paragraphs = []
  const headings = []
  let heading = null

  for (const node of clipboardContents) {
    if (!heading && node.type !== ENUMS.NODES.CONTENT_HEADING_TYPE) {
      paragraphs.push(createNodeFromJSON(node, schema))
    }

    if (node.type === ENUMS.NODES.CONTENT_HEADING_TYPE) {
      // if new heading is found, push the previous heading into the heading list
      // and reset the heading
      if (heading) {
        headings.push(createNodeFromJSON(heading, schema))
        heading = null
      }
      heading = {
        type: ENUMS.NODES.HEADING_TYPE,
        attrs: { level: node?.attrs.level },
        content: [
          node,
          {
            type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
            content: []
          }
        ]
      }
    } else {
      heading?.content.at(1).content.push(node)
    }
  }

  if (heading) {
    headings.push(createNodeFromJSON(heading, schema))
  }

  return [paragraphs, headings]
}

const clipboardPast = (slice, editor) => {
  const { state, view } = editor
  const { selection, doc, tr } = state
  const { from, to } = selection

  let $from = selection.$from
  let start = $from.pos

  // if user cursor is in the heading,
  // move the cursor to the contentWrapper and do the rest
  if ($from.parent.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
    const nextPos = $from.after()
    const $nextPos = tr.doc.resolve(nextPos)

    // Check if the next node is a contentWrapper
    if ($nextPos.nodeAfter && $nextPos.nodeAfter.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE) {
      const contentWrapperStart = nextPos + 1 // +1 to move inside the contentWrapper

      // Find the first paragraph or any other block inside the contentWrapper
      let firstBlockInsideContentWrapper = $nextPos.nodeAfter.firstChild

      // if the heading block does not contain contentWrapper as a first child
      // then create a contentWrapper block
      if (
        !firstBlockInsideContentWrapper ||
        firstBlockInsideContentWrapper.type.name === ENUMS.NODES.HEADING_TYPE
      ) {
        const contentWrapperBlock = {
          type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
          content: [
            {
              type: ENUMS.NODES.PARAGRAPH_TYPE
            }
          ]
        }

        const node = createNodeFromJSON(contentWrapperBlock, state.schema)
        tr.insert(contentWrapperStart, node)
        firstBlockInsideContentWrapper = node.firstChild
      }

      if (firstBlockInsideContentWrapper) {
        const firstBlockStart = contentWrapperStart + 1 // +1 to move inside the first block

        // Move the cursor to the first line of the contentWrapper
        const newSelection = new TextSelection(tr.doc.resolve(firstBlockStart))
        tr.setSelection(newSelection)

        // Update the variables accordingly
        $from = newSelection.$from
        start = $from.pos
      }
    }
  }

  // return Slice.empty

  const titleNode = $from.doc.nodeAt($from.start(1) - 1)
  let titleStartPos = $from.start(1) - 1
  let titleEndPos = titleStartPos + titleNode.content.size

  if (titleStartPos === 0) {
    titleStartPos = 0
    start = 1
    titleEndPos = titleEndPos - 2
  }

  const contentWrapper = getRangeBlocks(doc, start, titleEndPos)

  let { prevHStartPos } = getPrevHeadingPos(doc, titleStartPos, start - 1)

  const clipboardContentJson = slice.toJSON().content

  const [paragraphs, headings] = extractParagraphsAndHeadings(clipboardContentJson, state)

  // if there is no heading block, then just return
  if (headings.length <= 0) return slice

  tr.delete(to, titleEndPos)

  if (paragraphs.length !== 0) {
    // first append the paragraphs in the current selection
    tr.replaceWith(tr.mapping.map(from), tr.mapping.map(from), paragraphs)

    const newSelection = new TextSelection(tr.doc.resolve(selection.from))

    tr.setSelection(newSelection)
  } else {
    const firstHeading = headings.shift()
    const firstHeadingContent = firstHeading.firstChild.content.toJSON()
    const firstHeadingWrapperContent = firstHeading.lastChild.content.toJSON()

    const firstHeadingBlock = {
      type: ENUMS.NODES.PARAGRAPH_TYPE,
      content: firstHeadingContent
    }

    const firstHeadingNode = createNodeFromJSON(firstHeadingBlock, state.schema)

    tr.insert(tr.mapping.map(from), firstHeadingNode)

    // move cursour to the contentwrapper
    if (firstHeadingWrapperContent.length) {
      const firstHeadingWrapperContentNodes = firstHeadingWrapperContent.map((node) =>
        createNodeFromJSON(node, state.schema)
      )

      tr.insert(tr.mapping.map(tr.mapping.map(from) + 2), firstHeadingWrapperContentNodes)
    }

    tr.setSelection(new TextSelection(tr.doc.resolve(from)))
  }

  let lastBlockPos = paragraphs.length === 0 ? start : tr.mapping.map(start)

  const headingContent = contentWrapper.filter((x) => x.type === ENUMS.NODES.HEADING_TYPE)

  if (headingContent.length > 0) {
    headingContent.forEach((heading) => headings.push(createNodeFromJSON(heading, state.schema)))
  }

  let mapHPost = {}
  // return Slice.empty

  const lastH1Inserted = {
    startBlockPos: 0,
    endBlockPos: 0
  }

  try {
    // paste the headings
    for (let heading of headings) {
      const comingLevel = heading.content.firstChild.attrs.level

      const startBlock =
        lastH1Inserted.startBlockPos === 0 ? tr.mapping.map(start) : lastH1Inserted.startBlockPos
      const endBlock =
        lastH1Inserted.endBlockPos === 0
          ? tr.mapping.map(titleEndPos)
          : tr.doc.nodeAt(lastH1Inserted.startBlockPos).content.size + lastH1Inserted.startBlockPos

      mapHPost = getHeadingsBlocksMap(tr.doc, startBlock, endBlock)

      mapHPost = mapHPost.filter(
        (x) => x.startBlockPos >= (comingLevel === 1 ? titleStartPos : prevHStartPos)
      )

      let { prevBlock, shouldNested } = findPrevBlock(mapHPost, comingLevel)

      // find prevBlock.le in mapHPost
      const robob = mapHPost.filter((x) => prevBlock?.le === x?.le)

      if (robob.length > 1) {
        prevBlock = robob.at(-1)
      }

      lastBlockPos = prevBlock?.endBlockPos

      if (prevBlock && prevBlock.depth === 2) {
        prevHStartPos = prevBlock.startBlockPos
      }

      tr.insert(lastBlockPos - (shouldNested ? 2 : 0), heading)

      if (comingLevel === 1) {
        lastH1Inserted.startBlockPos = lastBlockPos
        lastH1Inserted.endBlockPos = tr.mapping.map(lastBlockPos + heading.content.size)
      }
    }

    if (contentWrapper.length) {
      let contentWrapperParagraphs = contentWrapper
        .filter((x) => x.type !== ENUMS.NODES.HEADING_TYPE)
        .map((paragraph) => createNodeFromJSON(paragraph, state.schema))

      // first append the paragraphs in the current selection
      tr.insert(lastBlockPos + headings.at(-1).content.size - 2, contentWrapperParagraphs)
    }
  } catch (error) {
    console.error('[heading]:', error)
    return Slice.empty
  }

  tr.setMeta('paste', true)
  view.dispatch(tr)

  return Slice.empty
}

export default clipboardPast
