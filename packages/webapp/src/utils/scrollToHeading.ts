export const scrollToHeading = (headingId: string) => {
  const headingSection = document.querySelector(`.ProseMirror [data-toc-id="${headingId}"]`)
  if (headingSection) {
    headingSection.scrollIntoView({ behavior: 'smooth' })
  }
}
