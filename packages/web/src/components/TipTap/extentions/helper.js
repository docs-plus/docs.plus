import { Slice, Fragment, NodeRange, NodeType, Mark, ContentMatch } from "prosemirror-model"

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
    tr.doc.nodesBetween(start, from, function (node, pos, parent, index) {
      if (node.type.name === "heading") {
        const headingLevel = node.firstChild?.attrs?.level
        const depth = tr.doc.resolve(pos).depth
        titleHMap.push({
          le: headingLevel,
          node: node.toJSON(),
          depth,
          startBlockPos: pos,
          endBlockPos: pos + node.nodeSize,
        })
      }
    })
  } catch (error) {
    console.error("[Heading]: getPrevHeadingList", error, { tr, start, from })
    // return Slice.empty
  } finally {
    return titleHMap
  }
}

/**
 *
 * @param {Object} doc prosemirror doc
 * @param {Number} start start pos
 * @param {Number} end end pos
 * @returns Array of Selection Block
 */
export const getSelectionBlocks = (doc, start, end) => {
  let firstHEading = true
  let prevDepth = 0
  const selectedContents = []
  doc.nodesBetween(start, end, function (node, pos, parent, index) {
    if (pos < start) return

    if (firstHEading && node.type.name !== 'heading' && parent.type.name === 'contentWrapper') {
      const depth = doc.resolve(pos).depth
      selectedContents.push({ depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON(), })
    }

    if (node.type.name === 'contentHeading') {
      const depth = doc.resolve(pos).depth
      selectedContents.push({ depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, type: 'paragraph', content: node.toJSON().content })
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
  doc.nodesBetween(start, end, function (node, pos, parent, index) {
    if (pos < start) return

    if (firstHEading && node.type.name !== 'heading' && parent.type.name === 'contentWrapper') {
      const depth = doc.resolve(pos).depth
      selectedContents.push({ depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON(), })
    }
    if (node.type.name === "heading") {
      firstHEading = false
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth
      if (prevDepth === 0) prevDepth = depth

      if (prevDepth >= depth) {
        selectedContents.push({ le: headingLevel, depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON(), })
        prevDepth = depth
      }
    }
  })
  return selectedContents
}
