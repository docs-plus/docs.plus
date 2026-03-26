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
  contents: DocContent[]
}

type DocContent = ParagraphContent | ListContent | HeadingContent

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

export const heading = (level: number, title: string, contents: DocContent[]) => {
  if (level < 2 || level > 6) {
    throw new Error('Heading level must be between 2-6.')
  }

  if (!title || title.trim() === '') {
    throw new Error('Heading title cannot be empty')
  }

  return {
    type: 'heading' as const,
    title,
    level,
    contents
  }
}

export const section = (title: string, contents: DocContent[]) => {
  return {
    type: 'section' as const,
    title,
    contents
  }
}
