import createTree from '@utils/treeStructure'
import filterTreeDFS from '@utils/filterTreeDFS'

// Helpers

/**
 * Retrieves the path from the given node to the root.
 *
 * @param {Node} node - The heading node from which the path starts.
 * @returns {Node[]} - An array of heading nodes  that representing the path from the given node to the root.
 */
const getPathToRoot = (node) => (!node.parent ? [node] : [node, ...getPathToRoot(node.parent)])

/**
 * Constructs a unique set of ids that represent the path from the headings to the root.
 *
 * @param {Node[]} headings - An array of heading nodes.
 * @returns {Set<string>} - A set containing unique ids representing the heading path to the root.
 */
const createPathToRoot = (headings) => {
  const ids = headings.flatMap((heading) => getPathToRoot(heading).map((node) => node.id)).filter((id) => id)
  return new Set(ids)
}

/**
 * Maps headings to a flat structure.
 *
 * @param {HTMLElement[]} headings - An array of HTML heading elements.
 * @returns {Array} - An array of arrays containing level, text content, and data-id for each heading.
 */
const mapHeadingsToFlatStructure = (headings) => {
  return [...headings].map((heading) => {
    const level = +heading.getAttribute('level')
    const textContent = heading.textContent
    const dataId = heading.closest('.wrapBlock').getAttribute('data-id')

    return [level, textContent, dataId]
  })
}

/**
 * Sorts the slugs based on their levels and weights.
 *
 * @param {Map<string, number>} slugsWithWeight - A map with each slug as key and its weight as value.
 * @param {Node[]} filteredNodes - An array of filtered heading nodes.
 * @returns {string[]} - A sorted array of slugs.
 */
const getSortedSlugs = (slugsWithWeight, filteredNodes) => {
  return [...slugsWithWeight.keys()].sort((a, b) => {
    const levelA = filteredNodes.find((x) => x.filterBy === a).level
    const levelB = filteredNodes.find((x) => x.filterBy === b).level

    // Sort primarily by level and secondarily by weight
    return levelA - levelB || slugsWithWeight.get(b) - slugsWithWeight.get(a)
  })
}

const filterTreeBySlugs = (tree, slugs) => {
  const filteredNodes = []
  filterTreeDFS(tree, slugs, filteredNodes)
  return filteredNodes
}

const handleSingleSlugCase = (filteredNodes, slugs) => {
  const pathToRoot = createPathToRoot(filteredNodes)
  return {
    headingIdsMap: new Set([...filteredNodes.map((x) => x.id), ...pathToRoot]),
    sortedSlugs: slugs.map((slug) => ({ type: 'parent', text: slug, existsInParent: true })),
    selectedNodes: filteredNodes.map((node) => ({ ...node, rootPath: createPathToRoot([node]) }))
  }
}

/**
 * Calculates the weight of each slug based on matching nodes.
 *
 * @param {string[]} slugs - An array of slugs to calculate weights for.
 * @param {Node[]} nodes - An array of nodes (headings) to compare against the slugs.
 * @returns {Map<string, number>} - A map of slugs and their respective weights.
 */
const calculateSlugsWeight = (slugs, nodes) => {
  // Initialize a map with slugs set to a weight of 0
  const slugsWithWeight = new Map(slugs.map((slug) => [slug, 0]))

  // Iterate over nodes to determine weight for each slug
  nodes.forEach((node) => {
    if (node.level !== 1 && slugsWithWeight.has(node.filterBy)) {
      // Increment weight of matching slug
      const currentWeight = slugsWithWeight.get(node.filterBy) || 0
      slugsWithWeight.set(node.filterBy, currentWeight + node.weight)
    }
  })

  return slugsWithWeight
}

/**
 * Classifies slugs into categories based on their weights.
 *
 * @param {Map<string, number>} slugsWithWeight - A map of slugs and their weights.
 * @param {Object[]} filteredNodes - An array of filtered heading nodes.
 * @returns {Object} - An object containing arrays of selected parent slugs, sorted slugs by weight, and zero-weight slugs.
 */

const classifySlugs = (slugsWithWeight, filteredNodes) => {
  const zeroWeightSlugs = [...slugsWithWeight.entries()]
    .filter(([_, weight]) => weight === 0)
    .map(([slug]) => slug)

  // Remove slugs with weight 0
  zeroWeightSlugs.forEach((slug) => slugsWithWeight.delete(slug))

  // Sort slugs based on levels and weights
  let sortedSlugs = getSortedSlugs(slugsWithWeight, filteredNodes)

  // Identify primary parent slug
  const firstSlug = sortedSlugs.shift()
  const firstSlugWeight = slugsWithWeight.get(firstSlug)

  const parentSlugs = [
    firstSlug,
    ...sortedSlugs.filter((slug) => slugsWithWeight.get(slug) === firstSlugWeight)
  ]

  // Filter out selected parent slugs from sorted list
  sortedSlugs = sortedSlugs.filter((slug) => !parentSlugs.includes(slug))

  return {
    parentSlugs,
    sortedSlugs,
    zeroWeightSlugs
  }
}

/**
 * Refines filtered nodes based on the primary parent slugs.
 *
 * @param {string[]} sortedSlugs - An array of sorted slugs based on weight.
 * @param {Object} headingTree - The tree structure of headings.
 * @param {string[]} parentSlugs - An array of primary slugs.
 * @returns {Object} - An object containing arrays of parent slugs and new filtered nodes.
 */
const refineFilterByPrimarySlugs = (headingTree, parentSlugs, sortedSlugs) => {
  let refinedNodes = []
  let isMirrorOfParent = sortedSlugs.length === 0

  filterTreeDFS(headingTree, parentSlugs, refinedNodes)

  let refinedFilteredNodes = isMirrorOfParent ? refinedNodes : []

  if (!isMirrorOfParent) {
    for (let heading of refinedNodes) {
      if (heading.children.length === 0) continue
      filterTreeDFS(heading, sortedSlugs, refinedFilteredNodes)
    }
  }

  if (refinedFilteredNodes.length === 0) refinedFilteredNodes.push(...refinedNodes)

  return { refindParentNodes: refinedNodes, refinedChildNodes: refinedFilteredNodes }
}

/**
 * Constructs the sorted slugs result combining parent and children nodes.
 *
 * @param {Object[]} refinedChildNodes - The refined array of nodes.
 * @param {string[]} parentSlugs - An array of primary parent slugs.
 * @param {string[]} sortedSlugs - An array of sorted slugs based on weight.
 * @param {string[]} zeroWeightSlugs - An array of slugs with zero weight.
 * @returns {Object[]} - An array of sorted slugs with their types and existence status in parents.
 */
const constructSortedSlugs = (refinedChildNodes, parentSlugs, sortedSlugs, zeroWeightSlugs) => {
  const parentMapSlugs = parentSlugs.map((slug) => ({
    type: 'parent',
    text: slug,
    existsInParent: true
  }))

  const childMapSlugs = [...sortedSlugs, ...zeroWeightSlugs].map((slug) => ({
    type: 'child',
    text: slug,
    existsInParent: refinedChildNodes.some((childNode) => slug == childNode.filterBy)
  }))

  return [...parentMapSlugs, ...childMapSlugs]
}

/**
 * Filters and maps headings based on provided slugs.
 *
 * @param {string[]} slugs - An array of strings to be used for filtering.
 * @param {HTMLElement[]} headings - An array of HTML elements representing the headings.
 *
 * @returns {{
 *   headingIdsMap: Set<string>,
 *   sortedSlugs: {type: 'parent'|'child', text: string, exsistInParent: boolean}[],
 *   selectedNodes: {level: number, text: string, parent?: Node, id?: string|number, children?: Node[], filterBy?: string, weight?: number, rootPath: string|number[]}[]
 * }}
 */
const getHeadingsFilterMap = (slugs, headings) => {
  // Convert slugs to lowercase
  slugs = slugs.map((slug) => slug.toLowerCase())

  const headingFlatMap = mapHeadingsToFlatStructure(headings)
  const headingTree = createTree(headingFlatMap)
  const filteredNodes = filterTreeBySlugs(headingTree, slugs)

  if (slugs.length === 1) {
    return handleSingleSlugCase(filteredNodes, slugs)
  }

  // Calculate weights for each slug
  const slugsWithWeight = calculateSlugsWeight(slugs, filteredNodes)

  const { parentSlugs, sortedSlugs, zeroWeightSlugs } = classifySlugs(slugsWithWeight, filteredNodes)

  const { refindParentNodes, refinedChildNodes } = refineFilterByPrimarySlugs(
    headingTree,
    parentSlugs,
    sortedSlugs
  )

  const sortedSlugsResult = constructSortedSlugs(refinedChildNodes, parentSlugs, sortedSlugs, zeroWeightSlugs)

  const pathToRoot = createPathToRoot(refinedChildNodes)
  const headingIdsMap = new Set([...refinedChildNodes.map((node) => node.id), ...pathToRoot])

  const selectedNodes = [
    ...refindParentNodes.map((x) => ({ ...x, rootPath: createPathToRoot([x]) })),
    ...refinedChildNodes.map((x) => ({ ...x, rootPath: createPathToRoot([x]) }))
  ]

  return { headingIdsMap, sortedSlugs: sortedSlugsResult, selectedNodes }
}

export default getHeadingsFilterMap
