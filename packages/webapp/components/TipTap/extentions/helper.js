import ENUMS from '../enums'
import { TextSelection } from '@tiptap/pm/state'

/**
 * Get a list of previous headings within a specified range in the document.
 * @param {Object} tr - Transform object
 * @param {Number} start - Start position
 * @param {Number} from - End position
 * @param {Number} [startPos=0] - Optional starting position to filter results
 * @returns {Array} Array of heading objects
 * @throws {Error} If the 'from' position is less than the 'start' position
 */
export const getPrevHeadingList = (tr, start, from, startPos = 0) => {
  if (from < start) {
    throw new Error(
      `[Heading]: Invalid position range. 'from' (${from}) is less than 'start' (${start}). startPos: ${startPos}`
    )
  }

  const titleHMap = []

  try {
    tr.doc.nodesBetween(start, from, function (node, pos) {
      if (startPos > 0 && pos < startPos) return
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
    console.error('[Heading]: Error in getPrevHeadingList', error, { tr, start, from })
  }

  return titleHMap
}

/**
 * Get selection blocks from a Prosemirror document.
 * @param {Object} doc - Prosemirror document
 * @param {Number} start - Start position
 * @param {Number} end - End position
 * @param {Boolean} [includeContentHeading=false] - Whether to include content heading
 * @param {Boolean} [range=false] - Whether to use range or nodesBetween
 * @returns {Array} Array of selection blocks
 */
export const getSelectionBlocks = (
  doc,
  start,
  end,
  includeContentHeading = false,
  range = false
) => {
  const selectedContents = []
  const processNode = (node, pos, parent) => {
    const depth = doc.resolve(pos).depth
    const isContentWrapper = parent.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE
    const isContentHeading = node.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE

    if (isContentWrapper && node.type.name !== ENUMS.NODES.HEADING_TYPE) {
      selectedContents.push({
        depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        ...node.toJSON()
      })
    } else if (isContentHeading) {
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
  }

  if (range) {
    doc.descendants(processNode)
  } else {
    doc.nodesBetween(start, end, (node, pos, parent) => {
      if (pos >= start) {
        processNode(node, pos, parent)
      }
    })
  }

  return selectedContents
}

export const getSelectionRangeBlocks = (doc, start, end, includeContentHeading = false) => {
  const selectedContents = []

  const processNode = (node, pos, parent) => {
    if (!node.isBlock) return
    const isContentWrapper = parent.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE
    const isContentHeading = node.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE

    if (node.type.name !== ENUMS.NODES.HEADING_TYPE && isContentWrapper) {
      selectedContents.push({
        depth: doc.resolve(pos).depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        ...node.toJSON()
      })
    } else if (isContentHeading) {
      selectedContents.push({
        depth: doc.resolve(pos).depth,
        level: node.attrs?.level,
        attrs: includeContentHeading ? node.attrs : {},
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        type: includeContentHeading ? node.type.name : ENUMS.NODES.PARAGRAPH_TYPE,
        content: node.toJSON().content
      })
    }
  }

  doc.nodesBetween(start, end, processNode)

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

  doc.nodesBetween(start, end, (node, pos, parent) => {
    if (pos < start) return

    const nodeType = node.type.name
    const isContentWrapper = parent.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE
    const isHeadingNode = nodeType === ENUMS.NODES.HEADING_TYPE

    if (firstHEading && !isHeadingNode && isContentWrapper) {
      selectedContents.push({
        depth: doc.resolve(pos).depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        ...node.toJSON()
      })
    } else if (isHeadingNode) {
      firstHEading = false
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      if (prevDepth === 0) prevDepth = depth

      if (prevDepth >= depth) {
        prevDepth = depth

        selectedContents.push({
          le: headingLevel,
          depth,
          startBlockPos: pos,
          endBlockPos: pos + node.nodeSize,
          ...node.toJSON()
        })
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
        endContentPos: pos + node.content.size,
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

export const createThisBlockMap = (state) => {
  const { selection } = state
  const { $from, $to } = selection
  const { depth } = $from.blockRange($to)

  const caretSelectionTextBlock = getSelectionTextNode(state)
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
          type: ENUMS.NODES.TEXT_TYPE,
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
    if (callback) callback()
  })
}

export const getNodeState = (headingId) => {
  try {
    const headingMap = JSON.parse(localStorage.getItem('headingMap')) || []
    return headingMap.find((h) => h.headingId === headingId) || { crinkleOpen: true }
  } catch (error) {
    console.error('Error parsing headingMap from localStorage:', error)
    return { crinkleOpen: true }
  }
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
  if (mapHPost.length === 0) {
    console.error('[Heading][findPrevBlock] no mapHPost')
    return { prevBlock: null, shouldNested: false }
  }

  // Find the last block with a level less than or equal to the heading level
  const prevBlock = mapHPost.findLast((x) => x.le <= headingLevel)

  if (!prevBlock) {
    const shouldNested = mapHPost[0].le < headingLevel

    // If no suitable block found, return the first block
    return { prevBlock: mapHPost[0], shouldNested }
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

// TODO: range of node number must be reconsidered, it has long range for iteration
export const insertRemainingHeadings = ({
  state,
  tr,
  headings,
  titleStartPos,
  titleEndPos,
  prevHStartPos
}) => {
  if (!headings.length) {
    console.info('[Heading][insertRemainingHeadings] no headings to insert')
    return true
  }

  let mapHPost = getHeadingsBlocksMap(tr.doc, titleStartPos, titleEndPos)

  // if the first heading is not h1, then we need to filter the mapHPost to only include headings that are before the current selection
  if (mapHPost.length > 1 && headings.at(0).le !== 1) {
    mapHPost = mapHPost.filter(
      (x) => x.startBlockPos < state.selection.$to.pos && x.startBlockPos >= titleStartPos
    )
  }

  for (const heading of headings) {
    const comingLevel = heading.level || heading.le || heading.content.at(0).level
    mapHPost = getPrevHeadingList(
      tr,
      mapHPost.at(0).startBlockPos,
      mapHPost.length === 1 && mapHPost.at(0).le === 1
        ? mapHPost.at(0).endBlockPos
        : tr.mapping.map(mapHPost.at(0).endBlockPos)
    )

    const prevHBlock = getPrevHeadingPos(tr.doc, titleStartPos, tr.mapping.map(titleEndPos))

    mapHPost = mapHPost.filter((x) => x.startBlockPos >= prevHBlock.prevHStartPos)

    const { prevBlock, shouldNested } = findPrevBlock(mapHPost, comingLevel)

    const node = state.schema.nodeFromJSON(heading)

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), node)
  }

  return true
}

export const putTextSelectionEndNode = (tr, insertPos, headingNode) => {
  const firstHeading = headingNode.at(0)
  const firstHeadingChild = firstHeading.firstChild
  const firstChildNodeSize = firstHeadingChild?.nodeSize

  const updatedSelection = new TextSelection(tr.doc.resolve(insertPos + firstChildNodeSize))

  return updatedSelection
}

/**
 * Recursively finds paragraphs within a node and pushes them to the newContent array.
 * @param {Object} currentNode - The current node to search for paragraphs.
 * @param {Array} newContent - The array to push found paragraphs into.
 */
const findParagraphs = (currentNode, newContent) => {
  currentNode.forEach((childNode) => {
    if (childNode.type.name === ENUMS.NODES.PARAGRAPH_TYPE) {
      newContent.push(childNode.toJSON())
    } else if (childNode.childCount > 0) {
      findParagraphs(childNode, newContent)
    }
  })
}

export const getEndPosSelection = (doc, state) => {
  const { $from, $to, from, to } = state.selection
  const { start, end } = $from.blockRange($to)

  const startPos =
    from === to ? end : isMultipleSelection(doc, from, to) ? end : from + doc?.nodeAt(from).nodeSize

  return startPos
}

// This is a temporary fix for detecting multiple selections.
// I haven’t found a better solution yet.
// Heads-up: selecting text by dragging the cursor works differently than double-clicking or tapping on a line.
export const isMultipleSelection = (doc, start, end) => {
  const textBetween = doc.textBetween(start, end, '-/||/-')
  const textBetweenArray = textBetween.split('-/||/-').filter((item) => item.trim() !== '')
  return textBetweenArray.length > 1
}

/**
 *
 * @param {Object} doc
 * @param {Object} state
 * @param {Number} start
 * @param {Number} end
 * @param {Object} attributes
 * @param {Object} block
 * @param {Array} contentWrapper
 * @returns {Array}
 */
export const createHeadingNodeFromSelection = (
  doc,
  state,
  start,
  end,
  attributes,
  block,
  contentWrapper
) => {
  const headings = []
  const { $from, $to } = state.selection

  if (isMultipleSelection(doc, start, end)) {
    const mResolve = doc.resolve(start)

    let { start: newStart } = $from.blockRange($to)

    // find the contentWrapper node position of the current(start) selection
    let contentWrapperPos = mResolve.pos
    while (contentWrapperPos > 0) {
      const node = doc.nodeAt(contentWrapperPos)
      if (node && node.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE) {
        break
      }
      contentWrapperPos--
    }

    // if the newStart is not a block, then we need to find the parent block position
    const newStartNode = doc.nodeAt(newStart)
    if (newStartNode && !newStartNode.isBlock) {
      const $newStart = doc.resolve(newStart)
      const parentPos = $newStart.before($newStart.depth)
      const parentNode = doc.nodeAt(parentPos)
      if (parentNode && parentNode.isBlock) {
        newStart = parentPos
      }
    }

    doc.nodesBetween(
      newStart,
      end,
      function (node, pos, parent) {
        if (
          !(
            node.isBlock &&
            parent.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE &&
            node.type.name !== ENUMS.NODES.HEADING_TYPE
          )
        )
          return

        let newContent = []
        if (node.type.name !== ENUMS.NODES.PARAGRAPH_TYPE) {
          findParagraphs(node, newContent)
        }

        const newHeading = {
          type: ENUMS.NODES.HEADING_TYPE,
          attrs: {
            level: attributes.level
          },
          content: [
            {
              type: ENUMS.NODES.CONTENT_HEADING_TYPE,
              content: newContent.length ? newContent : node.content.toJSON(),
              attrs: {
                level: attributes.level
              }
            },
            {
              type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
              content: [
                {
                  type: ENUMS.NODES.PARAGRAPH_TYPE
                }
              ]
            }
          ]
        }

        headings.push(newHeading)
      },
      newStart
    )

    // put the contentWrapper(rest paragraph nodes) in the last heading
    if (contentWrapper.length && headings.length) {
      const selectLastHeadingContent = headings.at(-1).content.at(-1).content
      // remove all empty paragraph
      selectLastHeadingContent.pop()
      selectLastHeadingContent.push(...contentWrapper)
    }
  } else {
    const jsonNode = {
      type: ENUMS.NODES.HEADING_TYPE,
      attrs: {
        level: attributes.level
      },
      content: [
        {
          type: ENUMS.NODES.CONTENT_HEADING_TYPE,
          // TODO: this is not correct, need to fix it, hint: the contnet could be multiple nodes like text, hyperlink and etc.
          content: [block.headingContent],
          attrs: {
            level: attributes.level
          }
        },
        {
          type: ENUMS.NODES.CONTENT_WRAPPER_TYPE,
          content: contentWrapper
        }
      ]
    }

    headings.push(jsonNode)
  }

  return headings.map((x) => state.schema.nodeFromJSON(x))
}

export const getSelectionTextNode = (state) => {
  const { selection, doc } = state
  const { $from, $to, $anchor } = selection

  return {
    type: ENUMS.NODES.TEXT_TYPE,
    text:
      doc.textBetween($from.pos, $to.pos, ' ') ||
      doc?.nodeAt($anchor.pos)?.text ||
      $anchor.nodeBefore?.text ||
      ' '
  }
}

/**
 *
 * @param {Object} doc prosemirror doc
 * @param {Number} start start pos
 * @param {Number} end end pos
 * @returns Array of Selection Block
 */
export const getSelectionRangeSlice = (doc, state, start, end) => {
  let firstHEading = true
  let prevDepth = 0
  const selectedContents = []
  const sResolve = doc.resolve(start)

  if (sResolve.parent.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
    // TODO: handle this case later
    throw new Error('Selection starts within a content heading')
  }

  let newStart = start - sResolve.parentOffset

  let contentWrapperPos = sResolve.pos
  while (contentWrapperPos > 0) {
    const node = doc.nodeAt(contentWrapperPos)
    if (node && node.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE) {
      break
    }
    contentWrapperPos--
  }

  const newStartNode = doc.nodeAt(newStart)
  if (newStartNode && !newStartNode.isBlock) {
    const $newStart = doc.resolve(newStart)
    const parentPos = $newStart.before($newStart.depth)
    const parentNode = doc.nodeAt(parentPos)
    if (parentNode && parentNode.isBlock) {
      newStart = parentPos
    }
  }

  doc.nodesBetween(newStart, end, function (node, pos, parent, index) {
    if (pos < contentWrapperPos) return
    if (!node.isBlock) return

    const isContentWrapper = parent.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE
    const nodeType = node.type.name

    if (firstHEading && isContentWrapper && nodeType !== ENUMS.NODES.HEADING_TYPE) {
      let contentObject = {
        depth: doc.resolve(pos).depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        node,
        ...node.toJSON()
      }

      selectedContents.push(contentObject)
    } else if (nodeType === ENUMS.NODES.HEADING_TYPE) {
      firstHEading = false
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      if (prevDepth === 0) prevDepth = depth

      if (prevDepth >= depth) {
        prevDepth = depth

        selectedContents.push({
          le: headingLevel,
          depth,
          startBlockPos: pos,
          endBlockPos: pos + node.nodeSize,
          ...node.toJSON()
        })
      }
    }
  })

  if (sResolve.parentOffset > 0) {
    let firstNode = selectedContents.at(0)
    const newposfor = newStart + sResolve.parentOffset
    const newContent = firstNode.node.cut(newposfor - firstNode.startBlockPos)
    selectedContents.at(0).content = newContent.content.toJSON()
    selectedContents.at(0).startBlockPos = newStart
  }

  return selectedContents
}
