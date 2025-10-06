// Assuming the Node class is defined somewhere else in your codebase
class Node {
  level: number
  heading: any
  parent: Node | null
  id: string
  children: Node[]

  constructor(level: number, heading: any, parent: Node | null = null, id: string) {
    this.level = level
    this.heading = heading
    this.parent = parent
    this.id = id
    this.children = []
  }
}

// Define a type for the result item
type ResultItem = {
  level: number
  heading: any
  parent: Node | null
  id: string
  children: Node[]
  weight: number
  filterBy: string
}

// Update the filterTreeDFS function with proper types
const filterTreeDFS = (node: Node | null, filters: any[], result: ResultItem[]): void => {
  if (!node) return

  for (const filter of filters) {
    if (filter && node.heading.toLowerCase().includes(filter.toLowerCase())) {
      const weight = node.level * 10 + 100
      result.push({ ...node, weight, filterBy: filter })
    }
  }

  for (const child of node.children) {
    filterTreeDFS(child, filters, result)
  }
}

// Export the function
export default filterTreeDFS
