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
    className="btn btn-primary btn-sm sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50">
    Skip to main content
  </button>
)

export default SkipToPadMain
