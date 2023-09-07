class Node {
  constructor(level, heading, parent = null, id) {
    this.level = level
    this.heading = heading
    this.parent = parent
    this.id = id
    this.children = []
  }
}

const createTree = (headings) => {
  const root = new Node(0, 'Root')
  let currentParent = root

  for (const [rawLevel, text, id] of headings) {
    const level = parseInt(rawLevel, 10)

    while (currentParent.level >= level) {
      currentParent = currentParent.parent
    }

    const node = new Node(level, text, currentParent, id)
    currentParent.children.push(node)
    currentParent = node
  }

  return root
}

export default createTree
