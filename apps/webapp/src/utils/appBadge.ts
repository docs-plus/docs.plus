/** Copies the bell count onto the installed app icon. Only desktop Chromium promises to
 * show it. A missing API or a rejected promise is a silent no-op. */
export const writeAppBadge = (count: number) => {
  if (!('setAppBadge' in navigator)) return
  const write = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge()
  write.catch(() => {})
}
