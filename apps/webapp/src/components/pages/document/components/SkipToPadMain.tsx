import { skipLinkClassName } from '@components/pages/home/SkipLink'

/** The pad's one `<main>` landmark. Each pad layout renders it as its editor scroll well. */
export const PAD_MAIN_ID = 'pad-main'

/**
 * A button, not a `#pad-main` link: Share copies `location.href`, and a hash would
 * leak into that link and add a Back entry.
 */
const SkipToPadMain = () => (
  <button
    type="button"
    onClick={() => document.getElementById(PAD_MAIN_ID)?.focus({ preventScroll: true })}
    className={skipLinkClassName}>
    Skip to main content
  </button>
)

export default SkipToPadMain
