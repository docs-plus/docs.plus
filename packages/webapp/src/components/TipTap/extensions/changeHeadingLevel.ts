import { Transaction } from '@tiptap/pm/state'
import { TIPTAP_NODES } from '@types'
import { logger } from '@utils/logger'

import changeHeadingLevelForwardH1 from './changeHeadingLevel-h1'
import { CommandArgs, HeadingAttributes } from './types'

/**
 * STACK-ATTACH re-parenting for forward level changes.
 *
 * After an in-place level increase, check if the heading should be nested
 * inside a preceding sibling whose level < newLevel. Without this step
 * the heading stays as a sibling (valid per parent > child, but wrong
 * per STACK-ATTACH ordering).
 */
const nestInPrecedingSibling = (tr: Transaction, headingPos: number, newLevel: number): void => {
  const doc = tr.doc
  const mappedPos = tr.mapping.map(headingPos)
  const headingNode = doc.nodeAt(mappedPos)
  if (!headingNode || headingNode.type.name !== TIPTAP_NODES.HEADING_TYPE) return

  const $h = doc.resolve(mappedPos)

  let cwDepth = -1
  for (let d = $h.depth; d >= 0; d--) {
    if ($h.node(d).type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE) {
      cwDepth = d
      break
    }
  }
  if (cwDepth < 0) return

  const cwNode = $h.node(cwDepth)
  const headingIdx = $h.index(cwDepth)

  for (let i = headingIdx - 1; i >= 0; i--) {
    const sibling = cwNode.child(i)
    if (sibling.type.name !== TIPTAP_NODES.HEADING_TYPE) continue

    const sibLevel = sibling.firstChild?.attrs?.level || sibling.attrs?.level || 1
    if (sibLevel >= newLevel) break

    // Compute sibling position in document
    let sibPos = $h.start(cwDepth)
    for (let j = 0; j < i; j++) sibPos += cwNode.child(j).nodeSize

    // Locate sibling's contentWrapper (second child: heading > contentHeading + contentWrapper)
    const sibCWPos = sibPos + 1 + sibling.child(0).nodeSize
    const sibCW = doc.nodeAt(sibCWPos)
    if (!sibCW || sibCW.type.name !== TIPTAP_NODES.CONTENT_WRAPPER_TYPE) break

    const insertPos = sibCWPos + sibCW.nodeSize - 1
    const headingEndPos = mappedPos + headingNode.nodeSize
    const content = doc.slice(mappedPos, headingEndPos).content

    // insertPos < mappedPos (sibling is before the heading), so delete first
    tr.delete(mappedPos, headingEndPos)
    tr.insert(tr.mapping.map(insertPos), content)
    break
  }
}

const changeHeadingLevel = (args: CommandArgs, attributes: HeadingAttributes): boolean => {
  // HN-10 §1: clamp level to valid range L = {1..10}
  const clampedLevel = Math.min(10, Math.max(1, attributes.level))
  if (clampedLevel !== attributes.level) {
    attributes = { ...attributes, level: clampedLevel }
  }

  const { state, tr } = args
  const { selection } = state
  const { $from, $to } = selection
  const { start } = $from.blockRange($to)!

  const comingLevel = attributes.level
  const currentHLevel = $from.doc.nodeAt(start)!.attrs.level

  if (comingLevel === currentHLevel) {
    logger.info('[heading]: comingLevel === currentHLevel, no change')
    return true
  }

  // H1 → X has special section-level semantics (section root changes)
  if (currentHLevel === 1) {
    logger.info('[Heading]: change heading level forward, currentHLevel === 1')
    return changeHeadingLevelForwardH1(args, attributes)
  }

  // All other cases: change level attribute in-place, then fix tree structure.
  // The hierarchy validation plugin handles remaining violations:
  //   - Children with level ≤ new parent level → extracted as siblings
  //   - Heading level ≤ enclosing parent level → extracted upward
  //   - Heading becomes H1 while nested → extracted to document root

  let headingDepth = -1
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === TIPTAP_NODES.HEADING_TYPE) {
      headingDepth = d
      break
    }
  }
  if (headingDepth < 0) return false

  const headingPos = $from.before(headingDepth)
  const headingNode = tr.doc.nodeAt(headingPos)
  if (!headingNode) return false

  const contentHeadingPos = headingPos + 1
  const contentHeading = headingNode.firstChild
  if (!contentHeading || contentHeading.type.name !== TIPTAP_NODES.CONTENT_HEADING_TYPE) {
    return false
  }

  logger.info(`[Heading]: in-place level change H${currentHLevel} → H${comingLevel}`)

  tr.setNodeMarkup(headingPos, null, { ...headingNode.attrs, level: comingLevel })
  tr.setNodeMarkup(tr.mapping.map(contentHeadingPos), null, {
    ...contentHeading.attrs,
    level: comingLevel
  })

  // Forward change: nest into preceding sibling per STACK-ATTACH
  if (comingLevel > currentHLevel) {
    nestInPrecedingSibling(tr, headingPos, comingLevel)
  }

  return true
}

export default changeHeadingLevel
