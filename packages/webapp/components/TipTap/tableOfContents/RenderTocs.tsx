import { RenderToc } from './RenderToc'

export const RenderTocs = (items: any) => {
  const renderedItems = []

  for (let i = 0; i < items.length; ) {
    const item = items[i]
    const children = []
    let j = i + 1

    while (j < items.length && items[j].level > item.level) {
      children.push(items[j])
      j++
    }
    renderedItems.push(
      <RenderToc key={j * i} childItems={children} item={item} renderTocs={RenderTocs} />
    )
    i = j
  }
  return renderedItems
}
