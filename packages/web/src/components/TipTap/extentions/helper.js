import { Slice, Fragment, NodeRange, NodeType, Mark, ContentMatch } from 'prosemirror-model'

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
      if (node.type.name === 'heading') {
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
export const getSelectionBlocks = (doc, start, end, includeContentHeading = false, range = false) => {
  const firstHEading = true
  const prevDepth = 0
  const selectedContents = []

  if (range) {
    console.log(doc)
    doc.descendants(function (node, pos, parent) {
      if (firstHEading && node.type.name !== 'heading' && parent.type.name === 'contentWrapper') {
        const depth = doc.resolve(pos).depth

        selectedContents.push({ depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON() })
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

  doc.nodesBetween(start, end, function (node, pos, parent, index) {
    if (pos < start) return

    if (firstHEading && node.type.name !== 'heading' && parent.type.name === 'contentWrapper') {
      const depth = doc.resolve(pos).depth

      selectedContents.push({ depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON() })
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

      selectedContents.push({ depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON() })
    }
    if (node.type.name === 'heading') {
      firstHEading = false
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      if (prevDepth === 0) prevDepth = depth

      if (prevDepth >= depth) {
        selectedContents.push({ le: headingLevel, depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON() })
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
    if (node.type.name === 'heading') {
      const headingLevel = node.firstChild?.attrs?.level
      const depth = doc.resolve(pos).depth

      titleHMap.push({ le: headingLevel, depth, startBlockPos: pos, endBlockPos: pos + node.nodeSize, index })
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
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: ' '
        }
      ]
    },
    paragraph: { type: 'paragraph' }
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
  const nodeState = headingMap.find(h => h.headingId === headingId) || { crinkleOpen: true }

  return nodeState
}
