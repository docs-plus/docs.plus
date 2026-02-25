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

/**
 * Validates that all child headings inside `contents` satisfy HN-10 STACK-ATTACH:
 *   child.level > parentLevel
 *
 * Catches invalid test documents at construction time rather than at test runtime.
 */
const validateChildLevels = (
  parentLevel: number,
  parentTitle: string,
  contents: DocContent[]
): void => {
  for (const item of contents) {
    if (item.type !== 'heading') continue

    const child = item as HeadingContent
    if (child.level <= parentLevel) {
      throw new Error(
        `HN-10 violation: child H${child.level} "${child.title}" must be > parent H${parentLevel} "${parentTitle}"`
      )
    }
    // Recurse into grandchildren
    validateChildLevels(child.level, child.title, child.contents)
  }
}

export const heading = (level: number, title: string, contents: DocContent[]) => {
  // HN-10 §1: Levels 2-10 for sub-headings (level 1 is reserved for sections)
  if (level < 2 || level > 10) {
    throw new Error('Heading level must be between 2-10. Level 1 is reserved for sections.')
  }

  if (!title || title.trim() === '') {
    throw new Error('Heading title cannot be empty')
  }

  // HN-10 §5 STACK-ATTACH: child level must be > parent level
  validateChildLevels(level, title, contents)

  return {
    type: 'heading' as const,
    title,
    level,
    contents
  }
}

export const section = (title: string, contents: DocContent[]) => {
  // HN-10 §3.3: Sections start at H1 (level 1). All direct children must be > 1.
  validateChildLevels(1, title, contents)

  return {
    type: 'section' as const,
    title,
    contents
  }
}

// ---------------------------------------------------------------------------
// Unsafe builders — for negative/invalid-structure tests ONLY.
// These bypass HN-10 validation so tests can verify the validator itself.
// ---------------------------------------------------------------------------

/** Creates a heading without HN-10 validation. Use ONLY in negative test cases. */
export const unsafeHeading = (level: number, title: string, contents: DocContent[]) => ({
  type: 'heading' as const,
  title,
  level,
  contents
})

/** Creates a section without HN-10 validation. Use ONLY in negative test cases. */
export const unsafeSection = (title: string, contents: DocContent[]) => ({
  type: 'section' as const,
  title,
  contents
})
