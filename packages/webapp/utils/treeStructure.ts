// Define a class for the Node structure
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

// Create a function to create a tree from headings
const createTree = (headings: any[]): Node => {
  const root = new Node(0, 'Root', null, '')
  let currentParent: Node = root

  for (const [rawLevel, text, id] of headings) {
    const level = parseInt(rawLevel, 10)

    while (currentParent.level >= level) {
      if (currentParent.parent) {
        currentParent = currentParent.parent
      } else {
        break // To handle the case where parent is null
      }
    }

    const node = new Node(level, text, currentParent, id)
    currentParent.children.push(node)
    currentParent = node
  }

  return root
}

// Export the function
export default createTree
