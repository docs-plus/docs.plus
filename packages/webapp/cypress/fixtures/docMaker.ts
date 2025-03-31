interface ListItem {
  text: string
  indent: number
}

type ParagraphContent = {
  type: 'paragraph'
  content: string
}

type ListContent = {
  type: 'bulletList' | 'orderedList'
  content: ListItem[]
}

type HeadingContent = {
  type: 'heading'
  title: string
  level: number
  contents: Array<ParagraphContent | ListContent>
}

type DocContent = ParagraphContent | ListContent | HeadingContent

// Update the original HeadingContent type to use the new types
type HeadingContents = ParagraphContent | ListContent

// Basic content elements
export const paragraph = (content: string) => ({
  type: 'paragraph',
  content
})

export const listItem = (text: string, indent = 0) => ({
  text,
  indent
})

export const orderedList = (items: ListItem[]) => ({
  type: 'orderedList',
  content: items
})

export const bulletList = (items: any[]) => ({
  type: 'bulletList',
  content: items
})

export const heading = (level: number, title: string, contents: HeadingContent[]) => {
  if (level < 2) {
    throw new Error('Heading level must be 2 or greater. Level 1 is not acceptable.')
  }

  if (!title || title.trim() === '') {
    throw new Error('Heading title cannot be empty')
  }

  return {
    type: 'heading',
    title,
    level,
    contents
  }
}

export const section = (title: string, contents: HeadingContents[]) => ({
  type: 'section',
  title,
  contents
})
