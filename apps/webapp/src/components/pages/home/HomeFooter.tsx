import { Icons } from '@components/icons/registry'
import { LuGithub, LuMessageCircle } from 'react-icons/lu'

export function HomeFooter() {
  return (
    <footer className="text-base-content/60 flex shrink-0 flex-wrap items-center justify-center gap-3 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm motion-safe:animate-[doc-region-in_220ms_ease-out_160ms_both] sm:gap-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="https://github.com/docs-plus/docs.plus"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository (opens in new tab)"
          className="bg-neutral text-neutral-content hover:bg-neutral/90 flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-medium transition-colors sm:text-sm">
          <LuGithub size={16} />
          <span>GitHub</span>
        </a>
        <a
          href="https://github.com/docs-plus/docs.plus/discussions"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub discussions (opens in new tab)"
          className="border-base-300 text-base-content hover:bg-base-200 flex min-h-11 items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-medium transition-colors sm:text-sm">
          <LuMessageCircle size={16} />
          <span>Discuss</span>
        </a>
      </div>

      <div className="bg-base-300 hidden h-6 w-px sm:block" role="presentation" />

      <a
        href="https://discord.com/invite/25JPG38J59"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Discord community (opens in new tab)"
        className="flex min-h-11 items-center gap-2 rounded-full bg-[#5865F2] px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#4752C4] sm:text-sm">
        <Icons.discord size={16} />
        <span>Discord</span>
      </a>
    </footer>
  )
}
