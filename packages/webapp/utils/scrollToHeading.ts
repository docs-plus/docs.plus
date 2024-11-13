export const scrollToHeading = (headingId: string) => {
  const headingSection = document.querySelector(`.ProseMirror .heading[data-id="${headingId}"]`)
  if (headingSection) {
    headingSection.scrollIntoView({ behavior: 'smooth' })
  }
}
