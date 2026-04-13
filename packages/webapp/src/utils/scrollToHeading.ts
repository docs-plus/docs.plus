import { scrollElementInMobilePadEditor } from './scrollMobilePadEditor'

export const scrollToHeading = (headingId: string) => {
  const headingSection = document.querySelector(`.ProseMirror [data-toc-id="${headingId}"]`)
  if (!headingSection) return
  if (!scrollElementInMobilePadEditor(headingSection, { behavior: 'smooth', block: 'nearest' })) {
    headingSection.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }
}
