const filterTreeDFS = (node, filters, result) => {
  if (!node) return

  for (const filter of filters) {
    if (node.heading.toLowerCase().includes(filter)) {
      const weight = node.level * 10 + 100
      result.push({ ...node, weight, filterBy: filter })
    }
  }

  for (const child of node.children) {
    filterTreeDFS(child, filters, result)
  }
}

export default filterTreeDFS
