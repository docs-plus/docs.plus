import ENUMS from '../enums'

/**
 *
 * @param {Object} tr  transform object
 * @param {Number} start  start pos
 * @param {Number} from  end pos
 * @returns
 */
export const getPrevHeadingList = (tr, start, from) => {
  const titleHMap = []

  if (from < start) throw new Error("[Heading]: position is invalid 'from < start'")
  try {
    tr.doc.nodesBetween(start, from, function (node, pos) {
      if (node.type.name === ENUMS.NODES.HEADING_TYPE) {
        const headingLevel = node.firstChild?.attrs?.level
        const depth = tr.doc.resolve(pos).depth

        titleHMap.push({
          le: headingLevel,
          node: node.toJSON(),
          depth,
          startBlockPos: pos,
          endBlockPos: pos + node.nodeSize
        })
      }
    })
  } catch (error) {
    console.error('[Heading]: getPrevHeadingList', error, { tr, start, from })
    // return Slice.empty
  }
  return titleHMap
}

/**
 *
 * @param {Object} doc prosemirror doc
 * @param {Number} start start pos
 * @param {Number} end end pos
 * @returns Array of Selection Block
 */
export const getSelectionBlocks = (doc, start, end, includeContentHeading = false, range = false) => {
  const firstHEading = true
  const selectedContents = []

  if (range) {
    doc.descendants(function (node, pos, parent) {
      if (
        firstHEading &&
        node.type.name !== ENUMS.NODES.HEADING_TYPE &&
        parent.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE
      ) {
        const depth = doc.resolve(pos).depth

        selectedContents.push({
          depth,
          startBlockPos: pos,
          endBlockPos: pos + node.nodeSize,
          ...node.toJSON()
        })
      }

      if (node.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
        const depth = doc.resolve(pos).depth

        selectedContents.push({
          depth,
          level: node.attrs?.level,
          attrs: includeContentHeading ? node.attrs : {},
          startBlockPos: pos,
          endBlockPos: pos + node.nodeSize,
          type: includeContentHeading ? node.type.name : ENUMS.NODES.PARAGRAPH_TYPE,
          content: node.toJSON().content
        })
      }
    })

    return selectedContents
  }

  doc.nodesBetween(start, end, function (node, pos, parent) {
    if (pos < start) return

    if (
      firstHEading &&
      node.type.name !== ENUMS.NODES.HEADING_TYPE &&
      parent.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE
    ) {
      const depth = doc.resolve(pos).depth

      selectedContents.push({
        depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        ...node.toJSON()
      })
    }

    if (node.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
      const depth = doc.resolve(pos).depth

      selectedContents.push({
        depth,
        level: node.attrs?.level,
        attrs: includeContentHeading ? node.attrs : {},
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        type: includeContentHeading ? node.type.name : ENUMS.NODES.PARAGRAPH_TYPE,
        content: node.toJSON().content
      })
    }
  })

  return selectedContents
}

export const getSelectionRangeBlocks = (doc, start, end, includeContentHeading = false) => {
  const firstHEading = true
  const selectedContents = []

  doc.nodesBetween(start, end, function (node, pos, parent) {
    if (
      firstHEading &&
      node.type.name !== ENUMS.NODES.HEADING_TYPE &&
      parent.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE
    ) {
      const depth = doc.resolve(pos).depth

      selectedContents.push({
        depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        ...node.toJSON()
      })
    }

    if (node.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
      const depth = doc.resolve(pos).depth

      selectedContents.push({
        depth,
        level: node.attrs?.level,
        attrs: includeContentHeading ? node.attrs : {},
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        type: includeContentHeading ? node.type.name : ENUMS.NODES.PARAGRAPH_TYPE,
        content: node.toJSON().content
      })
    }
  })

  return selectedContents
}

/**
 *
 * @param {Object} doc prosemirror doc
 * @param {Number} start start pos
 * @param {Number} end end pos
 * @returns Array of Selection Block
 */
export const getRangeBlocks = (doc, start, end) => {
  let firstHEading = true
  let prevDepth = 0
  const selectedContents = []

  doc.nodesBetween(start, end, function (node, pos, parent) {
    if (pos < start) return

    if (
      firstHEading &&
      node.type.name !== ENUMS.NODES.HEADING_TYPE &&
      parent.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE
    ) {
      const depth = doc.resolve(pos).depth

      selectedContents.push({
        depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        ...node.toJSON()
      })
    }
    if (node.type.name === ENUMS.NODES.HEADING_TYPE) {
      firstHEading = false
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      if (prevDepth === 0) prevDepth = depth

      if (prevDepth >= depth) {
        selectedContents.push({
          le: headingLevel,
          depth,
          startBlockPos: pos,
          endBlockPos: pos + node.nodeSize,
          ...node.toJSON()
        })
        prevDepth = depth
      }
    }
  })

  return selectedContents
}

/**
 * Returns a map of headings and the blocks that fall under them
 *
 * @param {Object} doc
 * @param {number} start
 * @param {number} end
 * @returns {Map<string, Object>}
 */
export const getHeadingsBlocksMap = (doc, start, end) => {
  const titleHMap = []

  doc.nodesBetween(start, end, function (node, pos, parent, index) {
    if (node.type.name === ENUMS.NODES.HEADING_TYPE) {
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      titleHMap.push({
        le: headingLevel,
        depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        index
      })
    }
  })

  return titleHMap
}

/**
 * Creates a block map of the editor state.
 * @param {Object} $from - The current selection's start position in the editor state.
 * @param {number} depth - The current selection's depth.
 * @param {Object} caretSelectionTextBlock - The current selection's text block.
 * @returns {Object} blockMap - The current selection's block map.
 */

export const createThisBlockMap = ($from, depth, caretSelectionTextBlock = ' ') => {
  return {
    parent: {
      end: $from.end(depth - 1),
      start: $from.start(depth - 1)
    },
    edge: {
      end: $from.end(depth - 1) + 1,
      start: $from.start(depth - 1) - 1
    },
    ancesster: {
      start: $from.start(1),
      end: $from.end(1)
    },
    end: $from.end(depth),
    start: $from.start(depth),
    nextLevel: 0,
    depth,
    headingContent: caretSelectionTextBlock,
    empty: {
      type: ENUMS.NODES.PARAGRAPH_TYPE,
      content: [
        {
          type: 'text',
          text: ' '
        }
      ]
    },
    paragraph: { type: ENUMS.NODES.PARAGRAPH_TYPE }
  }
}

/**
 * This method copies a text to clipboard
 * @param {string} text - the text to copy
 * @param {function} callback - a callback to execute after the text is copied
 */
export const copyToClipboard = (text, callback) => {
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard')
    if (callback) callback()
  })
}

export const getNodeState = (headingId) => {
  const headingMap = JSON.parse(localStorage.getItem('headingMap')) || []
  const nodeState = headingMap.find((h) => h.headingId === headingId) || {
    crinkleOpen: true
  }

  return nodeState
}

export const getPrevHeadingPos = (doc, startPos, endPos) => {
  let prevHStartPos = 0
  let prevHEndPos = 0

  doc.nodesBetween(startPos, endPos, function (node, pos) {
    if (node.type.name === ENUMS.NODES.HEADING_TYPE) {
      const depth = doc.resolve(pos).depth

      // INFO: this the trick I've looking for
      if (depth === 2) {
        prevHStartPos = pos
        prevHEndPos = pos + node.content.size
      }
    }
  })

  return { prevHStartPos, prevHEndPos }
}

/**
 * Finds the previous block based on the heading level and determines whether it should be nested.
 *
 * @param {Array} mapHPost - An array-like structure containing objects with 'le' property representing heading levels.
 * @param {number} headingLevel - A numeric value representing the level of the heading to find the previous block for.
 * @returns {Object} An object containing two properties:
 *   - prevBlock: The previous block found based on the conditions.
 *   - shouldNested: A boolean value indicating whether the block should be nested or not.
 */
export const findPrevBlock = (mapHPost, headingLevel) => {
  const prevBlockEqual = mapHPost.findLast((x) => x.le === headingLevel)
  const prevBlockGreaterFromFirst = mapHPost.find((x) => x.le >= headingLevel)
  const prevBlockGreaterFromLast = mapHPost.findLast((x) => x.le <= headingLevel)
  const lastBlock = mapHPost.at(-1)

  let prevBlock = prevBlockEqual || prevBlockGreaterFromLast || prevBlockGreaterFromFirst

  if (lastBlock.le <= headingLevel) {
    prevBlock = lastBlock
  }

  const shouldNested = prevBlock.le < headingLevel

  return { prevBlock, shouldNested }
}

export const extractParagraphsAndHeadings = (clipboardContents) => {
  const paragraphs = []
  const headings = []
  let heading = null

  for (const node of clipboardContents) {
    if (!heading && !node.level) {
      paragraphs.push(node)
    }

    if (node.level) {
      if (heading) {
        headings.push(heading)
        heading = null
      }
      heading = {
        endBlockPos: node.endBlockPos,
        startBlockPos: node.startBlockPos,
        level: node.level,
        type: ENUMS.NODES.HEADING_TYPE,
        attrs: { level: node.level },
        content: [
          {
            type: ENUMS.NODES.CONTENT_HEADING_TYPE,
            attrs: { level: node.level },
            content: node.content
          },
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
    headings.push(heading)
  }

  return [paragraphs, headings]
}

export const insertRemainingHeadings = ({
  state,
  tr,
  headings,
  titleStartPos,
  titleEndPos,
  prevHStartPos
}) => {
  let mapHPost = getHeadingsBlocksMap(state.doc, titleStartPos, titleEndPos)
  mapHPost = mapHPost.filter(
    (x) => x.startBlockPos < state.selection.$to.pos && x.startBlockPos >= titleStartPos
  )

  for (const heading of headings) {
    const commingLevel = heading.level || heading.le || heading.content.at(0).level
    mapHPost = getPrevHeadingList(tr, mapHPost[0].startBlockPos, tr.mapping.map(mapHPost[0].endBlockPos))
    mapHPost = mapHPost.filter(
      (x) => x.startBlockPos < heading.startBlockPos && x.startBlockPos >= prevHStartPos
    )

    const { prevBlock, shouldNested } = findPrevBlock(mapHPost, commingLevel)

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), state.schema.nodeFromJSON(heading))
  }

  return true
}
