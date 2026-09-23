/**
 * Plain text to the stored post body. The webapp strips `<>` from `content` and
 * keeps the composer's paragraphs in `html`. `@` goes too, so an agent cannot
 * fire mention or @everyone notifications.
 */
export const toChatPost = (text: string): { content: string; html: string } => {
  const content = text.replace(/\r\n?/g, '\n').replace(/[@<>]/g, '').trim()
  const html = content
    .split('\n')
    .map((line) => `<p>${line.replace(/&/g, '&amp;')}</p>`)
    .join('')
  return { content, html }
}
