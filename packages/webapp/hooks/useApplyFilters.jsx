import { useEffect } from 'react'
import { db } from '../db'

class Node {
  constructor(level, heading, parent = null, id) {
    this.level = level
    this.heading = heading
    this.parent = parent
    this.id = id
    this.children = []
  }
}

function createTree(headings) {
  let root = new Node(0, 'Root')
  let currentParent = root

  for (let heading of headings) {
    let [level, text, id] = heading
    level = parseInt(level, 10)

    while (currentParent.level >= level) {
      currentParent = currentParent.parent
    }

    let node = new Node(level, text, currentParent, id)
    currentParent.children.push(node)
    currentParent = node
  }

  return root
}

function filterTreeDFS(node, filters, result, ancestor = null) {
  if (!node) return

  const currentAncestor = node.level === 1 ? node : ancestor
  let weight = 0

  filters.forEach((filter) => {
    if (node.heading.toLowerCase().includes(filter)) {
      weight += node.level * 10 + 100
      result.push({ ...node, weight, ancestor: currentAncestor, filterBy: filter })
    }
  })

  node.children.forEach((child) => {
    filterTreeDFS(child, filters, result, currentAncestor)
  })
}

function getPathToRoot(node) {
  if (!node.parent) return [node]
  return [node, ...getPathToRoot(node.parent)]
}

const createPathToRoot = (headings) => {
  let pathToGod = []
  for (let heading of headings) {
    pathToGod.push(getPathToRoot(heading))
  }

  pathToGod = new Set([
    ...pathToGod
      .map((x) => x.map((x) => x.id))
      .flat()
      .filter((x) => x)
  ])
  return pathToGod
}

// TODO: Refactor from earth to stars
// TODO: More comments
const getHeadingsFilterMap = (slugs, headings) => {
  // remove the document slug from the slugs array
  slugs.shift()
  // make sure all slugs are in lowercase
  slugs = slugs.map((slug) => slug.toLowerCase())

  const headingFlatMap = Array.from(headings).map((x) => [
    +x.getAttribute('level'),
    x.textContent,
    x.closest('.wrapBlock').getAttribute('data-id')
  ])
  const headingTree = createTree(headingFlatMap)

  let filteredNodes = []
  filterTreeDFS(headingTree, slugs, filteredNodes)

  if (slugs.length === 1) {
    const pathToGod = createPathToRoot(filteredNodes)
    return new Set([...filteredNodes.map((x) => x.id), ...pathToGod])
  }

  // Initialize Map to store slugs with weight
  const slugsWithWeight = new Map()

  // Initialize slugs with a weight of 0
  for (const slug of slugs) {
    slugsWithWeight.set(slug, 0)
  }

  // Update the weight of slugs based on filteredNodes
  for (const heading of filteredNodes) {
    if (heading.level !== 1) {
      const currentWeight = slugsWithWeight.get(heading.filterBy) || 0
      slugsWithWeight.set(heading.filterBy, currentWeight + heading.weight)
    }
  }

  // Remove the slugs with weight 0
  for (const [slug, weight] of slugsWithWeight.entries()) {
    if (weight === 0) {
      slugsWithWeight.delete(slug)
    }
  }

  // sort the slugs by level and weight
  const slugsWithWeightSorted = [...slugsWithWeight.keys()].sort((a, b) => {
    const levelA = filteredNodes.find((x) => x.filterBy === a).level
    const levelB = filteredNodes.find((x) => x.filterBy === b).level

    if (levelA === levelB) return slugsWithWeight.get(b) - slugsWithWeight.get(a)

    return levelA - levelB
  })

  // pick the most low weight slug from slugsWithWeightSorted as the parents
  const pickFirstSlug = slugsWithWeightSorted.shift()
  const pickFirstSlugWeight = slugsWithWeight.get(pickFirstSlug)

  let selectedParent = [
    pickFirstSlug,
    ...slugsWithWeightSorted.filter((slug) => slugsWithWeight.get(slug) === pickFirstSlugWeight)
  ]

  let filterParentSlug = []
  filterTreeDFS(headingTree, selectedParent, filterParentSlug)

  // now in this step we need to search for rest slugs in the children of the selected parent
  const newFilterNode = []
  for (let heading of filterParentSlug) {
    if (heading.children.length === 0) continue
    filterTreeDFS(heading, slugsWithWeightSorted, newFilterNode)
  }

  const pathToRoot = createPathToRoot(newFilterNode)
  const uniqueArray = new Set([...newFilterNode.map((x) => x.id), ...pathToRoot])

  return uniqueArray
}

const useApplyFilters = (editor, slugs, applyingFilters, setApplyingFilters, router, rendering) => {
  useEffect(() => {
    if (!editor || rendering || slugs.length === 1) return

    const headings = document.querySelectorAll('.heading .title')

    const uniqueArr = getHeadingsFilterMap(slugs, headings)

    const dbMap = []
    headings.forEach((header) => {
      const wrapBlock = header.closest('.wrapBlock')
      const id = wrapBlock.getAttribute('data-id')
      dbMap.push({
        headingId: id,
        crinkleOpen: uniqueArr.has(id) ? true : false
      })
    })

    console.log({ dbMap, uniqueArr })

    // save the data to indexedDB
    db.docFilter.bulkPut(dbMap)
    // .then((e) => {
    //   console.info('bulkPut', e)
    // })

    localStorage.setItem('headingMap', JSON.stringify(dbMap))

    const timer = setTimeout(() => {
      setApplyingFilters(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [rendering])
}

export default useApplyFilters
