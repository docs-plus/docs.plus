import TypingText from '@components/ui/TypingText'
import { twMerge } from 'tailwind-merge'

import { HomeCollapseRegion } from './HomeCollapseRegion'
import { HOME_REGION_DURATION, homeRegionEase } from './homeMobileLayout'
import { HOME_TYPING_SR_LABEL, HOME_TYPING_TEXTS } from './homeTypingTexts'

interface HomeHeroProps {
  compact?: boolean
}

export function HomeHero({ compact = false }: HomeHeroProps) {
  return (
    <div
      className={twMerge(
        'text-center motion-safe:animate-[doc-region-in_220ms_ease-out_both] motion-safe:transition-[margin]',
        HOME_REGION_DURATION,
        homeRegionEase(compact),
        compact ? 'mb-3' : 'mb-6',
        'sm:mb-10'
      )}>
      <h1
        className={twMerge(
          'text-base-content font-bold motion-safe:transition-[font-size,margin] sm:mb-3 sm:text-5xl md:text-6xl',
          HOME_REGION_DURATION,
          homeRegionEase(compact),
          compact ? 'mb-0 text-xl' : 'mb-2 text-3xl'
        )}>
        Get everyone on the same page
      </h1>
      <HomeCollapseRegion collapsed={compact}>
        <p className="text-base-content/60 text-sm sm:text-lg">
          <span className="hidden sm:inline">Free, open-source collaborative documents for </span>
          <span className="sm:hidden">Open-source docs for </span>
          <span className="sr-only">{HOME_TYPING_SR_LABEL}</span>
          <span aria-hidden="true">
            <TypingText
              texts={HOME_TYPING_TEXTS}
              className="font-semibold"
              minWidth="130px"
              typingSpeed={80}
              deletingSpeed={40}
              delayAfterTyping={2000}
            />
          </span>
        </p>
      </HomeCollapseRegion>
    </div>
  )
}
