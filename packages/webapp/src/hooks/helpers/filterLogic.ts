import filterTreeDFS from '@utils/filterTreeDFS'
import createTree from '@utils/treeStructure'

// Types

interface TreeNode {
  id: string
  level: number
  heading: any
  parent: TreeNode | null
  children: TreeNode[]
  filterBy?: string
  weight?: number
}

interface SelectedNode extends TreeNode {
  rootPath: Set<string>
}

interface SlugClassification {
  type: 'parent' | 'child'
  text: string
  existsInParent: boolean
}

interface FilterResult {
  headingIdsMap: Set<string>
  sortedSlugs: SlugClassification[]
  selectedNodes: SelectedNode[]
}

// Helpers

/**
 * Retrieves the path from the given node to the root.
 */
const getPathToRoot = (node: TreeNode): TreeNode[] =>
  !node.parent ? [node] : [node, ...getPathToRoot(node.parent)]

/**
 * Constructs a unique set of ids that represent the path from the headings to the root.
 */
const createPathToRoot = (headings: TreeNode[]): Set<string> => {
  const ids = headings
    .flatMap((heading) => getPathToRoot(heading).map((node) => node.id))
    .filter((id): id is string => id !== undefined && id !== '')
  return new Set(ids)
}

/**
 * Maps headings to a flat structure.
 */
const mapHeadingsToFlatStructure = (headings: HTMLElement[]): [number, string, string][] => {
  return [...headings].map((heading) => {
    const level = +heading.getAttribute('level')!
    const textContent = heading.textContent || ''
    const dataId = heading.closest('.wrapBlock')?.getAttribute('data-id') || ''

    return [level, textContent, dataId]
  })
}

/**
 * Sorts the slugs based on their levels and weights.
 */
const getSortedSlugs = (slugsWithWeight: Map<string, number>, filteredNodes: any[]): string[] => {
  return [...slugsWithWeight.keys()].sort((a, b) => {
    const levelA = filteredNodes.find((x) => x.filterBy === a)!.level
    const levelB = filteredNodes.find((x) => x.filterBy === b)!.level

    // Sort primarily by level and secondarily by weight
    return levelA - levelB || slugsWithWeight.get(b)! - slugsWithWeight.get(a)!
  })
}

const filterTreeBySlugs = (tree: any, slugs: string[]): any[] => {
  const filteredNodes: any[] = []
  filterTreeDFS(tree, slugs, filteredNodes)
  return filteredNodes
}

const handleSingleSlugCase = (filteredNodes: any[], slugs: string[]): FilterResult => {
  const pathToRoot = createPathToRoot(filteredNodes)
  return {
    headingIdsMap: new Set([...filteredNodes.map((x) => x.id), ...pathToRoot]),
    sortedSlugs: slugs.map((slug) => ({
      type: 'parent' as const,
      text: slug,
      existsInParent: true
    })),
    selectedNodes: filteredNodes.map((node) => ({ ...node, rootPath: createPathToRoot([node]) }))
  }
}

/**
 * Calculates the weight of each slug based on matching nodes.
 */
const calculateSlugsWeight = (slugs: string[], nodes: any[]): Map<string, number> => {
  // Initialize a map with slugs set to a weight of 0
  const slugsWithWeight = new Map(slugs.map((slug) => [slug, 0]))

  // Iterate over nodes to determine weight for each slug
  nodes.forEach((node) => {
    if (node.level !== 1 && slugsWithWeight.has(node.filterBy)) {
      // Increment weight of matching slug
      const currentWeight = slugsWithWeight.get(node.filterBy) || 0
      slugsWithWeight.set(node.filterBy, currentWeight + (node.weight || 0))
    }
  })

  return slugsWithWeight
}

/**
 * Classifies slugs into categories based on their weights.
 */
const classifySlugs = (
  slugsWithWeight: Map<string, number>,
  filteredNodes: any[]
): { parentSlugs: string[]; sortedSlugs: string[]; zeroWeightSlugs: string[] } => {
  const zeroWeightSlugs = [...slugsWithWeight.entries()]
    .filter(([_, weight]) => weight === 0)
    .map(([slug]) => slug)

  // Remove slugs with weight 0
  zeroWeightSlugs.forEach((slug) => slugsWithWeight.delete(slug))

  // Sort slugs based on levels and weights
  let sortedSlugs = getSortedSlugs(slugsWithWeight, filteredNodes)

  // Identify primary parent slug
  const firstSlug = sortedSlugs.shift()!
  const firstSlugWeight = slugsWithWeight.get(firstSlug)!

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
 */
const refineFilterByPrimarySlugs = (
  headingTree: any,
  parentSlugs: string[],
  sortedSlugs: string[]
): { refindParentNodes: any[]; refinedChildNodes: any[] } => {
  let refinedNodes: any[] = []
  let isMirrorOfParent = sortedSlugs.length === 0

  filterTreeDFS(headingTree, parentSlugs, refinedNodes)

  let refinedFilteredNodes: any[] = isMirrorOfParent ? refinedNodes : []

  if (!isMirrorOfParent) {
    for (let heading of refinedNodes) {
      if (heading.children && heading.children.length === 0) continue
      filterTreeDFS(heading, sortedSlugs, refinedFilteredNodes)
    }
  }

  if (refinedFilteredNodes.length === 0) refinedFilteredNodes.push(...refinedNodes)

  return { refindParentNodes: refinedNodes, refinedChildNodes: refinedFilteredNodes }
}

/**
 * Constructs the sorted slugs result combining parent and children nodes.
 */
const constructSortedSlugs = (
  refinedChildNodes: any[],
  parentSlugs: string[],
  sortedSlugs: string[],
  zeroWeightSlugs: string[]
): SlugClassification[] => {
  const parentMapSlugs = parentSlugs.map((slug) => ({
    type: 'parent' as const,
    text: slug,
    existsInParent: true
  }))

  const childMapSlugs = [...sortedSlugs, ...zeroWeightSlugs].map((slug) => ({
    type: 'child' as const,
    text: slug,
    existsInParent: refinedChildNodes.some((childNode) => slug == childNode.filterBy)
  }))

  return [...parentMapSlugs, ...childMapSlugs]
}

const handelLinearAlgorithm = (headingTree: any, slugs: string[]): FilterResult => {
  const refinedFilteredNodes: any[] = []

  filterTreeDFS(headingTree, slugs, refinedFilteredNodes)

  const sortedSlugsResult = [...slugs].map((slug) => ({
    type: 'child' as const,
    text: slug,
    existsInParent: refinedFilteredNodes.some((childNode) => slug == childNode.filterBy)
  }))

  const pathToRoot = createPathToRoot(refinedFilteredNodes)
  const headingIdsMap = new Set([...refinedFilteredNodes.map((node) => node.id), ...pathToRoot])
  const selectedNodes = [
    ...refinedFilteredNodes.map((x) => ({ ...x, rootPath: createPathToRoot([x]) }))
  ]

  return { headingIdsMap, sortedSlugs: sortedSlugsResult, selectedNodes }
}

/**
 * Filters and maps headings based on provided slugs.
 *
 * @param slugs - An array of strings to be used for filtering.
 * @param headings - An array of HTML elements representing the headings.
 *
 * @returns An object containing:
 *   - headingIdsMap: Set of heading IDs
 *   - sortedSlugs: Array of classified slugs with type and existence status
 *   - selectedNodes: Array of selected nodes with their root paths
 */
const getHeadingsFilterMap = (slugs: string[], headings: HTMLElement[]): FilterResult => {
  // Convert slugs to lowercase
  slugs = slugs.map((slug) => slug.toLowerCase())
  const filterLinearAlgorithm = localStorage.getItem('setting.filterAlgorithm')

  const headingFlatMap = mapHeadingsToFlatStructure(headings)
  const headingTree = createTree(headingFlatMap)
  const filteredNodes = filterTreeBySlugs(headingTree, slugs)

  if (slugs.length === 1) {
    return handleSingleSlugCase(filteredNodes, slugs)
  }

  if (filterLinearAlgorithm === 'true') {
    return handelLinearAlgorithm(headingTree, slugs)
  }

  // Calculate weights for each slug
  const slugsWithWeight = calculateSlugsWeight(slugs, filteredNodes)

  const { parentSlugs, sortedSlugs, zeroWeightSlugs } = classifySlugs(
    slugsWithWeight,
    filteredNodes
  )

  const { refindParentNodes, refinedChildNodes } = refineFilterByPrimarySlugs(
    headingTree,
    parentSlugs,
    sortedSlugs
  )

  const sortedSlugsResult = constructSortedSlugs(
    refinedChildNodes,
    parentSlugs,
    sortedSlugs,
    zeroWeightSlugs
  )

  const pathToRoot = createPathToRoot(refinedChildNodes)
  const headingIdsMap = new Set([...refinedChildNodes.map((node) => node.id), ...pathToRoot])

  const selectedNodes = [
    ...refindParentNodes.map((x) => ({ ...x, rootPath: createPathToRoot([x]) })),
    ...refinedChildNodes.map((x) => ({ ...x, rootPath: createPathToRoot([x]) }))
  ]

  return { headingIdsMap, sortedSlugs: sortedSlugsResult, selectedNodes }
}

export default getHeadingsFilterMap
