import ENUMS from '../enums'

/**
 *
 * @param {Object} tr  transform object
 * @param {Number} start  start pos
 * @param {Number} from  end pos
 * @returns
 */
export const getPrevHeadingList = (tr, start, from, startPos = 0) => {
  const titleHMap = []

  if (from < start)
    throw new Error(
      `[Heading]: position is invalid 'from[${from}] < start[${start}]', startPos[${startPos}] `
    )
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
export const getSelectionBlocks = (
  doc,
  start,
  end,
  includeContentHeading = false,
  range = false
) => {
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
      node.isBlock &&
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

  if (lastBlock?.le <= headingLevel) {
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
  let mapHPost = getHeadingsBlocksMap(tr.doc, titleStartPos, titleEndPos)

  // if the first heading is not h1, then we need to filter the mapHPost to only include headings that are before the current selection
  if (mapHPost.length > 1 && headings.at(0).le !== 1) {
    mapHPost = mapHPost.filter(
      (x) => x.startBlockPos < state.selection.$to.pos && x.startBlockPos >= titleStartPos
    )
  }

  for (const heading of headings) {
    const commingLevel = heading.level || heading.le || heading.content.at(0).level
    mapHPost = getPrevHeadingList(
      tr,
      mapHPost.at(0).startBlockPos,
      headings.at(0).le === 1
        ? mapHPost.at(0).endBlockPos
        : tr.mapping.map(mapHPost.at(0).endBlockPos)
    )

    mapHPost = mapHPost.filter(
      (x) => x.startBlockPos < heading.startBlockPos && x.startBlockPos >= prevHStartPos
    )

    const { prevBlock, shouldNested } = findPrevBlock(mapHPost, commingLevel)

    tr.insert(prevBlock.endBlockPos - (shouldNested ? 2 : 0), state.schema.nodeFromJSON(heading))
    // update the prevHStartPos in order to narrow down the mapHpost
    prevHStartPos = prevBlock.startBlockPos
  }

  return true
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

  const { selection } = state
  const { $anchor, $head } = selection

  // if selection
  if ($anchor.pos !== $head.pos) {
    const mResolve = doc.resolve(start)
    let newStart = start - mResolve.parentOffset

    let contentWrapperPos = mResolve.pos
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
export const getSelectionRangeSlice = (doc, start, end) => {
  let firstHEading = true
  let prevDepth = 0
  const selectedContents = []
  const mResolve = doc.resolve(start)

  if (mResolve.parent.type.name === ENUMS.NODES.CONTENT_HEADING_TYPE) {
    // TODO: handle this case later
    throw new Error('Selection starts within a content heading')
  }

  let newStart = start - mResolve.parentOffset

  let contentWrapperPos = mResolve.pos
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

    if (
      firstHEading &&
      node.isBlock &&
      parent.type.name === ENUMS.NODES.CONTENT_WRAPPER_TYPE &&
      node.type.name !== ENUMS.NODES.HEADING_TYPE
    ) {
      const resolve = doc.resolve(pos)

      // Prepare the content object to be pushed into selectedContents
      let contentObject = {
        // resolve,
        depth: resolve.depth,
        startBlockPos: pos,
        endBlockPos: pos + node.nodeSize,
        index,
        node,
        ...node.toJSON()
      }

      // Add the prepared content object to selectedContents
      selectedContents.push(contentObject)

      // Log for debugging purposes
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

  if (mResolve.parentOffset > 0) {
    let firstNode = selectedContents.at(0)
    const newposfor = newStart + mResolve.parentOffset
    const newContent = firstNode.node.cut(newposfor - firstNode.startBlockPos)
    selectedContents[0].content = newContent.content.toJSON()
    selectedContents[0].startBlockPos = newStart
  }

  return selectedContents
}
